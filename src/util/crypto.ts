import * as crypto from 'crypto';

export class Crypto {

    private genericKey: string = 'a3K8Bx%2r8Y7#xDh';

    public encrypt(data, key: string = this.genericKey): string {
        const cipher = crypto.createCipheriv('aes-128-ecb', key, null);

        return cipher.update(JSON.stringify(data), 'utf8', 'base64') + cipher.final('base64');
    }

    public decrypt(data, key: string = this.genericKey): any {
        const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);

        return JSON.parse(decipher.update(data, 'base64', 'utf8') + decipher.final('utf8'));
    }

}
