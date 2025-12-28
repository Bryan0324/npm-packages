import {
    Context, Handler, PRIV, Schema, 
    Service, superagent, SystemModel, 
    TokenModel, 
    UserFacingError, ForbiddenError, Types,
    Model,
    requireSudo
} from 'hydrooj';
import { exec, spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import semver from 'semver';
import validatePackageName from 'validate-npm-package-name';
type CommandResult = {success: boolean, message?: string};
type PackageInfo = {name: string, version: string};
type PackageAction = 'add' | 'delete' | 'update';
type PackageOperation = PackageInfo & {action: PackageAction};

type AddonsManagerModel = {
    manageAddon: (action: PackageAction, name: string, version?: string) => Promise<CommandResult>,
    localUpdate: (name: string) => Promise<CommandResult>,
    getActivedPackages: () => Promise<string[]>,
    getLockedPackages: () => Promise<string[]>
};
function checkNpmPackageValidity(name : string): boolean {
    return validatePackageName(name).validForNewPackages;
}
function checkNpmVersionValidity(name : string): boolean {
    return name === '' || semver.valid(name) !== null;
}
function checkPackageIsLocal(name : string): boolean {
    return name[0] === '/' && path.isAbsolute(name);
}
class AddonsManagerHandler extends Handler {
    private static model: AddonsManagerModel;
    static setModel(m: AddonsManagerModel) { this.model = m; }
    @requireSudo
    async get()
    {
        this.response.template = 'manage_addons.html';
        const packages = await AddonsManagerHandler.model.getActivedPackages();
        let lockedPackages = await AddonsManagerHandler.model.getLockedPackages();
        for(const pkg of packages){
            if(checkPackageIsLocal(pkg)) lockedPackages.push(pkg);
        }
        this.response.body = this.request.body ||{
            packages: packages,
            lockedPackages: lockedPackages,
            result: null
        };
        this.renderHTML(this.response.template, {title: 'manage_addons'});
    }
    async post()
    {
        const body = this.request.body;
        const packages = await AddonsManagerHandler.model.getActivedPackages();
        let lockedPackages = await AddonsManagerHandler.model.getLockedPackages();
        for(const pkg of packages){
            if(checkPackageIsLocal(pkg)) lockedPackages.push(pkg);
        }

        let pkg: PackageOperation = 
        {
            name: body['package_name'],
            version: body['package_version'] || '',
            action: body['action']
        };

        // after computing packages, lockedPackages and building `pkg`
        let result: CommandResult = { success: false, message: 'Unknown error' };

        const isInstalled = packages.includes(pkg.name);
        const isLocked = lockedPackages.includes(pkg.name);

        if (checkPackageIsLocal(pkg.name)) {
          if (pkg.action !== 'update') {
            result = { success: false, message: 'Local packages can only be updated' };
          } else {
            result = await AddonsManagerHandler.model.localUpdate(pkg.name);
          }
        } else {
          if (pkg.action === 'add' && isInstalled) {
            result = { success: false, message: 'Package is already installed' };
          } else if ((pkg.action === 'update' || pkg.action === 'delete') && !isInstalled) {
            result = { success: false, message: 'Package is not installed' };
          } else if (pkg.action === 'delete' && isLocked) {
            result = { success: false, message: 'This package is locked and cannot be removed.' };
          } else {
            result = await AddonsManagerHandler.model.manageAddon(pkg.action, pkg.name, pkg.version);
          }
        }

        // optional: better log formatting
        console.log(`[Addons Manager] Action=${pkg.action} Package=${pkg.name} Version=${pkg.version} Result=${JSON.stringify(result)}`);
        if(result.success){
            this.back({
                result: result, 
                packages: packages,
                lockedPackages: lockedPackages
            });
        }else {
            throw new UserFacingError(result.message || 'Operation failed');
        }
        
    }
}

async function sendCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (error) => resolve({ success: false, message: error.message }));
    child.on('close', (code) => {
      resolve(code === 0
        ? { success: true, message: stdout || stderr }
        : { success: false, message: stderr || stdout || `Exit code ${code}` });
    });
  });
}

export default class AddonsManagerService extends Service {
    static Config = Schema.object({
        pathToHydro: Schema.string().description('Path to Hydro').required(),
    });

    constructor(ctx: Context, config: ReturnType<typeof AddonsManagerService.Config>) {
        super(ctx, 'hydrooj-addons-manager');
        ctx.Route('manage_addons', '/manage/addons', AddonsManagerHandler, PRIV.PRIV_ALL);
        global.Hydro.ui.inject('ControlPanel', 'manage_addons');
        init();
        async function init() {
            // Model functions
            async function manageAddon(action: PackageAction, name: string, version: string = ''): Promise<CommandResult> {
                if (!checkNpmPackageValidity(name)) return {success: false, message: 'Invalid package name'};
                if (version !== '' && !checkNpmVersionValidity(version)) return {success: false, message: 'Invalid version'};

                let result: CommandResult = {success: false, message: 'Unknown error'};
                switch (action) {
                    case 'delete':
                        await sendCommand('yarn', ['global', 'remove', name], config.pathToHydro);
                        const rmRes = await sendCommand('hydrooj', ['addon', 'remove', name], config.pathToHydro);
                        result = rmRes;
                        break;
                    case 'update':
                        result = await sendCommand('yarn', ['global', 'upgrade', name + (version ? '@' + version : ''), '--latest'], config.pathToHydro);
                        break;
                    case 'add':
                        await sendCommand('yarn', ['global', 'add', name + (version ? '@' + version : '')], config.pathToHydro);
                        result = await sendCommand('hydrooj', ['addon', 'add', name], config.pathToHydro);
                        break;
                }
                return result;
            }
            async function localUpdate(name: string): Promise<CommandResult> {
                if (!checkPackageIsLocal(name)) return {success: false, message: 'Not a local package'};
                let result: CommandResult = {success: false, message: 'Unknown error'};
                result = await sendCommand('git', ['pull', 'origin', 'main'], name);
                return result;
            }
            async function getActivedPackages(): Promise<string[]> {
                try {
                    const data = await fs.readFile(config.pathToHydro+'addon.json', 'utf-8');
                    return JSON.parse(data);
                } catch (err) {
                    return [];
                }
            }

            async function getLockedPackages(): Promise<string[]> {
                try {
                    const data = await fs.readFile(config.pathToHydro+'addon-locked.json', 'utf-8');
                    return JSON.parse(data);
                } catch (err) {
                    return [];
                }
            }
            const addonsManagerModel: AddonsManagerModel = { 
                manageAddon: manageAddon,
                localUpdate: localUpdate,
                getActivedPackages: () => getActivedPackages(), 
                getLockedPackages: () => getLockedPackages()
            };
            AddonsManagerHandler.setModel(addonsManagerModel);
        }
    }
}