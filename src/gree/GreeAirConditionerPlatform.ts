import * as dgram from 'dgram';
import {RemoteInfo, Socket} from 'dgram';
import {
    API,
    Characteristic,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service
} from 'homebridge';
import {Crypto} from '../util/crypto';
import {GreeAirConditionerAccessory} from './GreeAirConditionerAccessory';
import {GreeAirConditionerDevice} from './GreeAirConditionerDevice';
import {PLATFORM_NAME, PLUGIN_NAME} from '../settings';

export class GreeAirConditionerPlatform implements DynamicPlatformPlugin {

    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    public readonly config: Config;
    public readonly crypto: Crypto = new Crypto();
    public readonly socket: Socket = dgram.createSocket('udp4');

    private scanTimer: NodeJS.Timeout | undefined;
    private scanCount: number = 0;

    private readonly devices: Record<string, PlatformAccessory> = {};
    private readonly greeAcDevices: Record<string, GreeAirConditionerAccessory> = {};


    constructor(public readonly logger: Logger,
                public readonly platformConfig: PlatformConfig,
                public readonly api: API) {
        this.config = platformConfig.options;

        this.api.on('didFinishLaunching', () => {

            this.socket.on('message', (buffer: Buffer, remoteInfo: RemoteInfo) =>
                GreeAirConditionerDevice.handleDevResponse(
                    this.logger,
                    this.crypto,
                    buffer,
                    remoteInfo,
                    this.registerDevice
                )
            );
            this.socket.on('error', (err: Error) => this.logger.error(err.message));
            this.scanForDevices();
        });
    }


    configureAccessory(accessory: PlatformAccessory): void {
        this.devices[accessory.context.device.mac] = accessory;
    }


    private scanForDevices(): void {
        try {
            this.socket.bind(this.config.port, () => {

                this.scanTimer = setInterval(() => {
                    GreeAirConditionerDevice.scan(this.config, this.logger, this.socket);
                    ++this.scanCount;

                    if (this.scanCount > this.config.scanMaxRetries &&
                        this.scanTimer) {
                        clearInterval(this.scanTimer);
                    }
                }, this.config.scanInterval);
            });
        } catch (e: any) {
            this.logger.error(e);
        }
    }

    private registerDevice(deviceContext: DeviceContext): void {
        let accessory = this.devices[deviceContext.mac];

        if (accessory === null) {
            accessory = new this.api.platformAccessory(deviceContext.mac, this.api.hap.uuid.generate(deviceContext.mac));

            this.devices[deviceContext.mac] = accessory;
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        if (accessory && this.greeAcDevices[accessory.UUID] === null) {
            accessory.context.device = deviceContext;
            this.greeAcDevices[accessory.UUID] = new GreeAirConditionerAccessory(this, accessory);
        }
    }

}