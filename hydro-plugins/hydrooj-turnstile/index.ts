import {
    Context, Handler, PRIV, Schema, Service, superagent, SystemModel, TokenModel, UserFacingError, ValidationError, ForbiddenError, Type
} from 'hydrooj';

function snakeCaseToBigCamelCase(str: string): string {
    return str
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

async function turnstileHandler(thisArg: Handler, config: ReturnType<typeof TurnstileService.Config>, summitXpath: string, containerXpath: string) {
    if (!config.key) return;
    if (thisArg.request.method !== 'post') {
        thisArg.UiContext.turnstileKey = config.key;
        thisArg.UiContext.summitXpath = summitXpath;
        thisArg.UiContext.containerXpath = containerXpath;
        return;
    }
    const token = thisArg.request.body['cf-turnstile-response'];
    const remoteip = thisArg.request.ip;
    if (!token) {
        throw new ValidationError('Turnstile token is missing');
    }
    const formData = new FormData();
    formData.append('secret', config.secret);
    formData.append('response', token);
    formData.append('remoteip', remoteip);
    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        console.log('Turnstile verification result:', result);
        if(result.success)return;

        throw new ValidationError('Turnstile verification failed');
    } catch (error) {
        console.error('Turnstile validation error:', error);
        
        throw new ValidationError('Turnstile verification failed');
    }
}

const turnstileUnit = Schema.object({
    pageKeyData: Schema.string().description('data-page attribute of the page').required(),
    summitXpath: Schema.string().description('the Xpath of the submit button of the page').required(),
    containerXpath: Schema.string().description('the Xpath of the container element for Turnstile').required(),
    handlerName: Schema.string().description('the name of the handler of the page. If not specified, it will be generated from pageKeyData in BigCamelCase'),
});

export default class TurnstileService extends Service {
    static Config = Schema.object({
        key: Schema.string().description('Turnstile key').required(),
        secret: Schema.string().description('Turnstile Secret').role('secret').required(),
        registration: Schema.array(turnstileUnit).description('Registration pages for Turnstile').default([
            {
                pageKeyData: 'user_register',
                summitXpath: '//*[@id="submit"]',
                containerXpath: '//*[@id="panel"]/div[4]/div/div/div/form',
                handlerName: '',
            },
            {
                pageKeyData: 'discussion_create',
                summitXpath: '//*[@id="panel"]/div[3]/div/div[1]/div/div[2]/form/div[3]/div/button[1]',
                containerXpath: '//*[@id="panel"]/div[3]/div/div[1]/div/div[2]/form/div[3]/div',
                handlerName: '',
            },
            {
                pageKeyData: 'blog_edit',
                summitXpath: '//*[@id="panel"]/div[3]/div/div[1]/div/div/form/div[3]/div/button[1]',
                containerXpath: '//*[@id="panel"]/div[3]/div/div[1]/div/div/form/div[3]/div',
                handlerName: '',
            },
            {
                pageKeyData: 'problem_create',
                summitXpath: '//*[@id="panel"]/div[3]/div/div[1]/div/div/form/div[5]/div/button',
                containerXpath: '//*[@id="panel"]/div[3]/div/div[1]/div/div/form/div[5]/div',
                handlerName: '',
            },
        ]),
    });

    constructor(ctx: Context, config: ReturnType<typeof TurnstileService.Config>) {
        super(ctx, 'hydrooj-turnstile');
        for(const unit of config.registration) {
            if(!unit.handlerName || unit.handlerName.trim() === '') {
                unit.handlerName = snakeCaseToBigCamelCase(unit.pageKeyData);
            }
            ctx.on(`handler/before/${unit.handlerName}`, async (thisArg) => turnstileHandler.call(this, thisArg, config, unit.summitXpath, unit.containerXpath));
        }
    }
}

