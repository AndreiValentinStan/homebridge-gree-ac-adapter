import {RemoteInfo, Socket} from 'dgram';
import {EventEmitter} from 'events';
import {Logger} from 'homebridge';
import {Crypto} from '../util/crypto';
import {GreeAirConditionerCommands} from './GreeAirConditionerCommands';

/**
 * Provides implementation for all aspects of controlling
 * a Wi-Fi enabled Gree Air Conditioner Device.
 */
export class GreeAirConditionerDevice {

    /**
     * {@link EventEmitter} object used for triggering the refresh of the cached device` status.
     *
     * @private
     */
    private readonly refreshEventEmitter: EventEmitter = new EventEmitter();

    /**
     * {@link DeviceStatus} object representing the current device` status.
     *
     * @private
     */
    private readonly deviceStatus: DeviceStatus = new DeviceStatus();


    /**
     * Timestamp representing the last time when the device` status was requested.
     *
     * @private
     */
    private lastGetDeviceStatus: number = Date.now();
    /**
     * The symmetric key used for decryption and encryption.
     *
     * @private
     */
    private key: string | undefined;
    /**
     * Boolean representing whether this device is available or not.
     *
     * @private
     */
    private unavailable: boolean = true;
    /**
     * Number of consecutive unresponded <i>status</i> requests. This variable is incremented at every <i>status</i>
     * request and resets when a <i>dat</i> response is received.
     *
     * @private
     */
    private unrespondedStatusRequests: number = 0;


    /**
     * Constructs a new {@link GreeAirConditionerDevice} and it initializes it by doing the following:
     * - it binds the {@link status} method to the 'refresh' event of the {@link refreshEventEmitter};
     * - it binds the {@link handleResponse} method to the 'message' event of the {@link socket};
     * - it executes the {@link bind} method.
     *
     * @param config Configuration.
     * @param logger Logger to be used.
     * @param crypto Used for decryption and encryption.
     * @param socket Used for sending and receiving data to and from the device.
     * @param deviceContext It contains information about the device (IP address or the MAC).
     * @param refreshCallback Called after the status has been updated.
     */
    constructor(private readonly config: Config,
                private readonly logger: Logger,
                private readonly crypto: Crypto,
                private readonly socket: Socket,
                private readonly deviceContext: DeviceContext,
                private readonly refreshCallback: () => void) {

        this.refreshEventEmitter.on('refresh', () => {
            if (this.lastGetDeviceStatus + 5000 > Date.now()) {
                this.status();
            }
        });

        this.socket.on('message', buffer => {
            const packMessage: PackMessage = JSON.parse(buffer.toString());

            if (packMessage.cid === this.deviceContext.mac) {
                this.handleResponse(packMessage);
            }
        });

        this.bind();
    }


    /**
     * Sends a scan request as a scan message type. The request is sent as a
     * broadcast message to the local network.
     *
     * @param config Configuration.
     * @param socket {@link Socket} object to be used to send the message.
     *               The socket must be created and bound before executing this method.
     * @param logger Logger to be used.
     */
    public static scan(config: Config, logger: Logger, socket: Socket): void {
        logger.debug("scan() --- Called");

        try {
            const scanMessage: ScanMessage = {
                t: 'scan'
            };
            socket.send(
                JSON.stringify(scanMessage),
                config.scanPort,
                config.scanAddress
            );
        } catch (e: any) {
            logger.error(e);
        }

        logger.debug("scan() --- Returned void");
    }

    /**
     * It handles a <i>dev</i> response. Executes integrity checks on pack message,
     * decrypts encrypted dev pack and then calls provided callback.
     *
     * @param logger Logger to be used.
     * @param crypto {@link Crypto} object to be used to decrypt the encrypted dev pack.
     * @param buffer Buffer containing the pack message.
     * @param remoteInfo Information about the remote which sent the dev response.
     * @param callback Called after integrity checks and decryption.
     */
    public static handleDevResponse(logger: Logger,
                                    crypto: Crypto,
                                    buffer: Buffer,
                                    remoteInfo: RemoteInfo,
                                    callback: (deviceContext: DeviceContext) => void): void {

        logger.debug("handleDevResponse() --- Called with parameters of interests: %j, %j", buffer, remoteInfo);
        const packMessage = JSON.parse(buffer.toString());
        logger.debug("handleDevResponse() --- Extracted pack message %j", packMessage);

        if (packMessage.i === 1 && packMessage.tcid === '') {

            logger.debug("handleDevResponse() --- The response is a dev response");
            const devPack: DevPack = crypto.decrypt(packMessage.pack);
            logger.debug("handleDevResponse() --- Decrypted pack %j", devPack);

            if (devPack.t === 'dev') {

                logger.debug("handleDevResponse() --- Calling callback");
                //@formatter:off
                callback({
                    mac:     devPack.mac,
                    address: remoteInfo.address,
                    brand:   devPack.brand,
                    model:   devPack.model,
                    name:    devPack.name,
                    version: devPack.ver
                });
                //@formatter:on
            }
        }

        logger.debug("handleDevResponse() --- Returned void");
    }


    /**
     * Returns whether this device is available or not. After creation, the device is unavailable until the first
     * <i>dat</i> response is received.
     * <br>
     * If 3 <i>status</i> requests are sent without receiving any response, the device becomes unavailable. It becomes
     * available at the receiving of a <i>dat</i> response.
     *
     * @returns Whether this device is available or not.
     */
    public isUnavailable(): boolean {
        return this.unavailable;
    }

    /**
     * Returns the current status. This method does not request the status at each call from the actual device.
     * It returns the cached data, which is refreshed asynchronously, as long as five seconds have not passed
     * since the last time when this method was called. If five seconds have passed, the status request to
     * the actual device is skipped until a new call on this method is made.
     *
     * @returns {@link DeviceStatus} object representing the current device` status.
     */
    public getDeviceStatus(): DeviceStatus {
        this.logger.debug("getDeviceStatus() --- Called");

        this.lastGetDeviceStatus = Date.now();

        this.logger.debug("getDeviceStatus() --- Returned %j", this.deviceStatus);

        return this.deviceStatus;
    }

    /**
     * Sends a <i>cmd</i> request as a pack message. Example of {@link commands} parameter:
     * ```js
     * commands = {
     *     'Pow': 1,
     *     'Mode': 1,
     *     'SwingLfRig': 0,
     *     'SwUpDn': 2
     * };
     * ```
     *
     * @param commands Object containing the commands to be executed by the device to achieve the desired state.
     */
    public cmd(commands: any): void {
        this.logger.debug("cmd() --- Called");

        const cmdPack: CmdPack = {
            t: 'cmd',
            opt: Object.keys(commands),
            p: Object.keys(commands).map(k => commands[k])
        };
        this.sendRequest(cmdPack);

        this.logger.debug("cmd() --- Returned void");
    }


    /**
     * Sends a <i>bind</i> request as a pack message.
     *
     * @private
     */
    private bind(): void {
        this.logger.debug("bind() --- Called");

        const bindPack: BindPack = {
            t: 'bind',
            uid: 0,
            mac: this.deviceContext.mac
        };
        this.sendRequest(bindPack);

        this.logger.debug("bind() --- Returned void");
    }

    /**
     * Sends a <i>status</i> request as a pack message.
     *
     * @private
     */
    private status(): void {
        this.logger.debug("status() --- Called");

        if (this.unrespondedStatusRequests++ === 4) {
            this.unavailable = true;
        }

        const statusPack: StatusPack = {
            t: 'status',
            mac: this.deviceContext.mac,
            cols: Object.keys(GreeAirConditionerCommands).map(k => GreeAirConditionerCommands[k].code)
        };
        this.sendRequest(statusPack);

        this.logger.debug("status() --- Returned void");
    }

    /**
     * Sends a request as a pack message.
     *
     * @param requestPack Object containing the data.
     *                    It can be either a {@link BindPack}, {@link StatusPack} or a {@link CmdPack}.
     * @private
     */
    private sendRequest(requestPack: RequestPack): void {
        this.logger.debug("sendRequest() --- Called with parameter %j", requestPack);

        try {
            const packMessage: PackMessage = {
                t: 'pack',
                i: this.key === undefined ? 1 : 0,
                uid: 0,
                cid: 'app',
                tcid: this.deviceContext.mac,
                pack: this.crypto.encrypt(requestPack, this.key)
            };
            this.socket.send(
                JSON.stringify(packMessage),
                this.config.port,
                this.deviceContext.address
            );
        } catch (e: any) {
            this.logger.error(e);
        }

        this.logger.debug("sendRequest() --- Returned void");
    }


    /**
     * Decrypts encrypted pack from the pack message, and if the response` status is 200 (OK),
     * it calls one of the following based on the type of the pack:
     * {@link handleBindOkResponse}, {@link handleDatResponse}, {@link handleResResponse}.
     *
     * @param packMessage Object containing the message from the device.
     * @private
     */
    private handleResponse(packMessage: PackMessage): void {
        this.logger.debug("handleResponse() --- Called with parameter %j", packMessage);

        const pack: ResponsePack = this.crypto.decrypt(packMessage.pack, this.key);

        this.logger.debug("handleResponse() --- Decrypted pack %j", pack);

        if (pack.r === 200) {
            switch (pack.t) {
                //@formatter:off
                case 'bindok': this.handleBindOkResponse(<BindOkPack>pack); break;
                case 'dat':    this.handleDatResponse(<DatPack>pack);       break;
                case 'res':    this.handleResResponse(<ResPack>pack);       break;
                //@formatter:on
            }
        }

        this.logger.debug("handleResponse() --- Returned void");
    }

    /**
     * It handles a <i>bindok</i> response by setting the key and configuring {@link refreshEventEmitter}
     * to emit 'refresh' events.
     *
     * @param pack {@link BindOkPack} object containing the data.
     * @private
     */
    private handleBindOkResponse(pack: BindOkPack): void {
        this.logger.debug("handleBindOkResponse() --- Called with parameter %j", pack);

        this.key = pack.key;
        setInterval(
            () => this.refreshEventEmitter.emit('refresh'),
            this.config.refreshInterval
        );

        this.logger.debug("handleBindOkResponse() --- Returned void");
    }

    /**
     * It handles a <i>dat</i> response by updating the cached status.
     *
     * @param pack {@link DatPack} object containing the data.
     * @private
     */
    private handleDatResponse(pack: DatPack): void {
        this.logger.debug("handleDatResponse() --- Called with parameter %j", pack);

        this.unavailable = false;
        this.unrespondedStatusRequests = 0;

        pack.cols.forEach((col: string, i: number) => {
            this.deviceStatus[col] = pack.dat[i];
        });
        this.refreshCallback();

        this.logger.debug("handleDatResponse() --- Returned void");
    }

    /**
     * It handles a <i>res</i> response by updating the cached status.
     *
     * @param pack {@link ResPack} object containing the data.
     * @private
     */
    private handleResResponse(pack: ResPack): void {
        this.logger.debug("handleResResponse() --- Called with parameter %j", pack);

        pack.opt.forEach((col: string, i: number) => {
            this.deviceStatus[col] = (pack.val || pack.p)[i];
        });
        this.refreshCallback();

        this.logger.debug("handleResResponse() --- Returned void");
    }

}