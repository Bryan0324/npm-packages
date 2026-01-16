import {
    Context, Handler, PRIV, Schema, Service, superagent, SystemModel, TokenModel, UserFacingError, ValidationError, ForbiddenError, Type
} from 'hydrooj';

async function turnstileHandler(thisArg: Handler, config: ReturnType<typeof TurnstileService.Config>) {
    if (!config.key) return;
    if (thisArg.request.method !== 'post') {
        thisArg.UiContext.turnstileKey = config.key;
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

export default class TurnstileService extends Service {
    static Config = Schema.object({
        key: Schema.string().description('Turnstile key').required(),
        secret: Schema.string().description('Turnstile Secret').role('secret').required(),
    });

    constructor(ctx: Context, config: ReturnType<typeof TurnstileService.Config>) {
        super(ctx, 'hydrooj-turnstile');
        ctx.on('handler/before/DiscussionCreate', async (thisArg) => turnstileHandler.call(this, thisArg, config));
        ctx.on('handler/before/UserRegister', async (thisArg) => turnstileHandler.call(this, thisArg, config));
        ctx.on('handler/before/BlogEdit', async (thisArg) => turnstileHandler.call(this, thisArg, config));
    }
}