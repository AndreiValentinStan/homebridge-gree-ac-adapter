import {Characteristic, HAPStatus, PlatformAccessory, Service} from 'homebridge';
import {GreeAirConditionerCommands as cmd} from './GreeAirConditionerCommands';
import {GreeAirConditionerDevice} from './GreeAirConditionerDevice';
import {GreeAirConditionerPlatform} from './GreeAirConditionerPlatform';

/**
 * Provides implementation for all aspects of linking a Homekit
 * Accessory to a Wi-Fi enabled Gree Air Conditioner Device.
 */
export class GreeAirConditionerAccessory {

    public readonly Service: typeof Service;
    public readonly Characteristic: typeof Characteristic;

    /**
     * Underlying {@link GreeAirConditionerDevice} object that connects this accessory to the physical device.
     */
    private readonly device: GreeAirConditionerDevice;

    /**
     * All values for which device's {@link GreeAirConditionerCommands.swingUpDown.value swingUpDown} is considered
     * swinging.
     */
    private readonly isSwingingEnabledValues: number[] = [
        cmd.swingUpDown.value.full,
        cmd.swingUpDown.value.swingLowest,
        cmd.swingUpDown.value.swingLower,
        cmd.swingUpDown.value.swingMiddle,
        cmd.swingUpDown.value.swingHigher,
        cmd.swingUpDown.value.swingHighest
    ];

    //@formatter:off
    private heaterCoolerService: Service;
    private xFanService:         Service;
    private healthService:       Service;
    private lightService:        Service;
    private sleepService:        Service;
    private quietService:        Service;
    private turboService:        Service;
    //@formatter:on

    /**
     * Constructs a new {@link GreeAirConditionerAccessory}, initializes it (this includes initializing the underlying
     * {@link GreeAirConditionerDevice} object).
     *
     * @param platform {@link GreeAirConditionerPlatform} of this plugin.
     * @param accessory {@link PlatformAccessory} of this plugin.
     */
    constructor(private readonly platform: GreeAirConditionerPlatform, private readonly accessory: PlatformAccessory) {
        this.Service = this.platform.Service;
        this.Characteristic = this.platform.Characteristic;

        this.device = new GreeAirConditionerDevice(
            platform.config,
            platform.logger,
            platform.crypto,
            platform.socket,
            this.accessory.context.device,
            this.refresh
        );

        this.heaterCoolerService =
            this.accessory.getService(this.Service.HeaterCooler) ||
            this.accessory.addService(this.Service.HeaterCooler);
        this.xFanService =
            this.accessory.getService(this.Service.Switch) ||
            this.accessory.addService(this.Service.Switch);
        this.healthService =
            this.accessory.getService(this.Service.Switch) ||
            this.accessory.addService(this.Service.Switch);
        this.lightService =
            this.accessory.getService(this.Service.Switch) ||
            this.accessory.addService(this.Service.Switch);
        this.sleepService =
            this.accessory.getService(this.Service.Switch) ||
            this.accessory.addService(this.Service.Switch);
        this.turboService =
            this.accessory.getService(this.Service.Switch) ||
            this.accessory.addService(this.Service.Switch);
        this.quietService =
            this.accessory.getService(this.Service.Switch) ||
            this.accessory.addService(this.Service.Switch);

        this.setAccessoryInformation(this.accessory.context.device);

        this.bindActiveHandlers();
        this.bindCurrentHeaterCoolerStateHandlers();
        this.bindTargetHeaterCoolerStateHandlers();
        this.bindCurrentTemperatureHandlers();
        this.bindThresholdTemperatureHandlers();
        this.bindRotationSpeed();
        this.bindTemperatureDisplayUnits();
        this.bindSwingMode();

        this.bindXFanHandlers();
        this.bindHealthHandlers();
        this.bindLightHandlers();
        this.bindSleepHandlers();
        this.bindQuietHandlers();
        this.bindTurboHandlers();
    }


    //region Heater Cooler Characteristics Handlers

    //region Active

    /**
     * It uses device's {@link GreeAirConditionerCommands.power power} and {@link GreeAirConditionerCommands.mode mode}
     * to determine whether the accessory is active or not.
     * <br>
     * The accessory is considered active if {@link GreeAirConditionerCommands.power.code power} is
     * {@link GreeAirConditionerCommands.power.value.on on}, and {@link GreeAirConditionerCommands.mode.code mode} is
     * {@link GreeAirConditionerCommands.mode.value.auto auto}, {@link GreeAirConditionerCommands.mode.value.cool cool}
     * or {@link GreeAirConditionerCommands.mode.value.heat heat}.
     * <br>
     * The accessory is considered inactive in any of the following cases:
     * - {@link GreeAirConditionerCommands.power.code power} is {@link GreeAirConditionerCommands.power.value.off off}
     * - {@link GreeAirConditionerCommands.power.code power} is {@link GreeAirConditionerCommands.power.value.on on},
     * and {@link GreeAirConditionerCommands.mode.code mode} is {@link GreeAirConditionerCommands.mode.value.dry dry} or
     * {@link GreeAirConditionerCommands.mode.value.fan fan}.
     *
     * @returns {@link Characteristic.Active} (0 or 1 meaning <b>INACTIVE</b> or <b>ACTIVE</b>).
     */
    handleActiveGet(): 0 | 1 {
        if (this.device.isUnavailable()) {
            throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }

        switch (this.device.getDeviceStatus()[cmd.power.code]) {
            case cmd.power.value.on:
                switch (this.device.getDeviceStatus()[cmd.mode.code]) {
                    case cmd.mode.value.auto:
                    case cmd.mode.value.cool:
                    case cmd.mode.value.heat:
                        return this.Characteristic.Active.ACTIVE;
                    default:
                        return this.Characteristic.Active.INACTIVE;
                }
            case cmd.power.value.off:
                return this.Characteristic.Active.INACTIVE;
        }
        return this.Characteristic.Active.INACTIVE;
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.power power} with accessory's active state. This function
     * returns immediately if the value to be set is the same as the one returned by {@link handleActiveGet}.
     *
     * @param value Active state to be set.
     */
    handleActiveSet(value): void {
        if (value === this.handleActiveGet()) {
            return;
        }

        //@formatter:off
        const commands = {
            [cmd.power.code]: (() => {
                switch (value) {
                    case this.Characteristic.Active.ACTIVE:   return cmd.power.value.on;
                    case this.Characteristic.Active.INACTIVE: return cmd.power.value.off;
                }
            })()
        };
        //@formatter:on

        this.device.cmd(commands);
    }

    //endregion


    //region Current Heater Cooler State

    /**
     * It uses accessory's {@link handleCurrentTemperatureGet}, {@link handleThresholdTemperatureGet} and
     * {@link handleTargetHeaterCoolerStateGet} to determine its current state.
     * <br>
     * If <i>target temperature</i> is lower than <i>current temperature</i> and <i>target state</i> is either
     * <i>AUTO</i> or <i>COOL</i>, than <i>current state</i> is <b>COOLING</b>. If <i>target temperature</i> is greater
     * than <i>current temperature</i> and <i>target state</i> is either <i>AUTO</i> or <i>HEAT</i>, than
     * <i>current state</i> is <b>HEATING</b>. Otherwise, <i>current state</i> is <b>IDLE</b>.
     *
     * @returns {@link Characteristic.CurrentHeaterCoolerState} (1, 2 or 3 meaning <b>IDLE</b>, <b>HEATING</b> or <b>COOLING</b>).
     */
    handleCurrentHeaterCoolerStateGet(): 1 | 2 | 3 {
        if (this.device.isUnavailable()) {
            throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }

        //@formatter:off
        const currentTemperature: number    = this.handleCurrentTemperatureGet();
        const targetTemperature:  number    = this.handleThresholdTemperatureGet();
        const targetState:        0 | 1 | 2 = this.handleTargetHeaterCoolerStateGet();

        if (targetTemperature < currentTemperature && (
               targetState === this.Characteristic.TargetHeaterCoolerState.AUTO ||
               targetState === this.Characteristic.TargetHeaterCoolerState.COOL
        )) {
            return this.Characteristic.CurrentHeaterCoolerState.COOLING;
        }

        if (targetTemperature > currentTemperature && (
               targetState === this.Characteristic.TargetHeaterCoolerState.AUTO ||
               targetState === this.Characteristic.TargetHeaterCoolerState.HEAT
        )) {
            return this.Characteristic.CurrentHeaterCoolerState.HEATING;
        }
        //@formatter:on

        return this.Characteristic.CurrentHeaterCoolerState.IDLE;
    }

    //endregion Current Heater Cooler State


    //region Target Heater Cooler State

    /**
     * It uses device's {@link GreeAirConditionerCommands.mode mode} to determine accessory's target state.
     *
     * @returns {@link Characteristic.TargetHeaterCoolerState} (0, 1 or 2 meaning <b>AUTO</b>, <b>COOL</b> or <b>HEAT</b>).
     */
    handleTargetHeaterCoolerStateGet(): 0 | 1 | 2 {
        if (this.device.isUnavailable()) {
            throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
        //@formatter:off
        switch (this.device.getDeviceStatus()[cmd.mode.code]) {
            case cmd.mode.value.auto: return this.Characteristic.TargetHeaterCoolerState.AUTO;
            case cmd.mode.value.cool: return this.Characteristic.TargetHeaterCoolerState.COOL;
            case cmd.mode.value.heat: return this.Characteristic.TargetHeaterCoolerState.HEAT;
        }
        //@formatter:on
        throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.mode mode} with accessory's target state. This function
     * returns immediately if the value to be set is the same as the one returned by
     * {@link handleTargetHeaterCoolerStateGet}.
     * <br>
     * This function will also send a command to the device for setting
     * {@link GreeAirConditionerCommands.swingUpDown swingUpDown} to a predefined value based on what
     * {@link handleSwingModeGet} is returning.
     *
     * @param value Target state to be set.
     */
    handleTargetHeaterCoolerStateSet(value): void {
        if (value === this.handleTargetHeaterCoolerStateGet()) {
            return;
        }

        //@formatter:off
        const commands = {
            [cmd.mode.code]: (() => {
                switch (value) {
                    case this.Characteristic.TargetHeaterCoolerState.AUTO: return cmd.mode.value.auto;
                    case this.Characteristic.TargetHeaterCoolerState.HEAT: return cmd.mode.value.heat;
                    case this.Characteristic.TargetHeaterCoolerState.COOL: return cmd.mode.value.cool;
                }
            })(),
            [cmd.swingLeftRight.code]: cmd.swingLeftRight.value.default
        };
        switch (this.handleSwingModeGet()) {
            case this.Characteristic.SwingMode.SWING_DISABLED:
                commands[cmd.swingUpDown.code] = (() => {
                    switch (value) {
                        case this.Characteristic.TargetHeaterCoolerState.AUTO: return cmd.swingUpDown.value.default;
                        case this.Characteristic.TargetHeaterCoolerState.HEAT: return cmd.swingUpDown.value.fixedLowest;
                        case this.Characteristic.TargetHeaterCoolerState.COOL: return cmd.swingUpDown.value.fixedHighest;
                    }
                    return cmd.swingUpDown.value.default;
                })();
                break;
            case this.Characteristic.SwingMode.SWING_ENABLED:
                commands[cmd.swingUpDown.code] = (() => {
                    switch (value) {
                        case this.Characteristic.TargetHeaterCoolerState.AUTO: return cmd.swingUpDown.value.default;
                        case this.Characteristic.TargetHeaterCoolerState.HEAT: return cmd.swingUpDown.value.swingLowest;
                        case this.Characteristic.TargetHeaterCoolerState.COOL: return cmd.swingUpDown.value.swingHighest;
                    }
                    return cmd.swingUpDown.value.default;
                })();
                break;
        }
        //@formatter:on

        this.device.cmd(commands);
    }

    //endregion Target Heater Cooler State


    //region Current Temperature

    /**
     * It uses device's {@link GreeAirConditionerCommands.temperatureSensor temperature sensor} to determine accessory's
     * current temperature. The {@link GreeAirConditionerCommands.temperatureSensor temperature sensor} has an offset of
     * 40 to prevent working with negative numbers.
     *
     * @returns A number representing accessory's current temperature in Celsius.
     */
    handleCurrentTemperatureGet(): number {
        if (this.device.isUnavailable()) {
            throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
        return this.device.getDeviceStatus()[cmd.temperatureSensor.code] - 40;
    }

    //endregion


    //region Cooling/Heating Threshold Temperature

    /**
     * It uses device's {@link GreeAirConditionerCommands.targetTemperature target temperature} to determine accessory's
     * target temperature.
     *
     * @returns A number representing accessory's target temperature in Celsius.
     */
    handleThresholdTemperatureGet(): number {
        if (this.device.isUnavailable()) {
            throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
        return this.device.getDeviceStatus()[cmd.targetTemperature.code];
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.targetTemperature target temperature} with accessory's
     * threshold temperature. This function returns immediately if the value to be set is the same as the one returned
     * by {@link handleThresholdTemperatureGet} or if {@link handleTemperatureDisplayUnitsGet} returns <i>null</i>.
     * <br>
     * If {@link handleTemperatureDisplayUnitsGet} returns
     * {@link Characteristic.TemperatureDisplayUnits.CELSIUS CELSIUS} than the device will also receive a command for
     * setting {@link GreeAirConditionerCommands.temperatureOffset temperature offset} to 1.
     *
     * @param value Threshold temperature to be set.
     */
    handleThresholdTemperatureSet(value): void {
        if (value === this.handleThresholdTemperatureGet()) {
            return;
        }

        const units: number = this.handleTemperatureDisplayUnitsGet();

        const commands = units === this.Characteristic.TemperatureDisplayUnits.CELSIUS
            ? {[cmd.targetTemperature.code]: value}
            : {[cmd.targetTemperature.code]: value, [cmd.temperatureOffset.code]: 1};

        this.device.cmd(commands);
    }

    //endregion


    //region Rotation Speed

    /**
     * It uses device's {@link GreeAirConditionerCommands.speed speed}, multiplied by 20, to determine accessory's
     * rotation speed.
     *
     * @returns A number representing accessory's rotation speed.
     */
    handleRotationSpeedGet(): number {
        if (this.device.isUnavailable()) {
            throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
        return this.device.getDeviceStatus()[cmd.speed.code] * 20;
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.speed speed} with accessory's rotation speed divided by 20.
     * This function returns immediately if the value to be set is the same as the one returned by
     * {@link handleRotationSpeedGet} or if either {@link handleQuietGet} or {@link handleTurboGet} returns true.
     *
     * @param value Rotation speed to be set.
     */
    handleRotationSpeedSet(value): void {
        if (value === this.handleRotationSpeedGet()
            || this.handleQuietGet()
            || this.handleTurboGet()) {
            return;
        }

        this.device.cmd({[cmd.speed.code]: value / 20});
    }

    //endregion


    //region Temperature Display Units

    /**
     * It uses device's {@link GreeAirConditionerCommands.units units} to determine accessory's temperature display
     * units. This only reflects the display and operating units of the device.
     * <br>
     * The accessory's {@link handleCurrentTemperatureGet} and {@link handleThresholdTemperatureGet} are operating with
     * <i>CELSIUS</i> and independently to what this function returns.
     * <br>
     * The accessory's {@link handleThresholdTemperatureSet} is operating with <i>CELSIUS</i> but it uses this function
     * to send the proper command/commands to the device.
     *
     * @returns {@link Characteristic.TemperatureDisplayUnits} (0 or 1 meaning <b>CELSIUS</b> or <b>FAHRENHEIT</b>).
     */
    handleTemperatureDisplayUnitsGet(): 0 | 1 {
        if (this.device.isUnavailable()) {
            throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
        //@formatter:off
        switch (this.device.getDeviceStatus()[cmd.units.code]) {
            case cmd.units.value.celsius:    return this.Characteristic.TemperatureDisplayUnits.CELSIUS;
            case cmd.units.value.fahrenheit: return this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
        }
        //@formatter:on
        throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.units units} with accessory's temperature display units. This
     * function returns immediately if the value to be set is the same as the one returned by
     * {@link handleTemperatureDisplayUnitsGet}. This only affects the display and operating units of the device.
     *
     * @param value Temperature display units to be set.
     */
    handleTemperatureDisplayUnitsSet(value): void {
        if (value === this.handleTemperatureDisplayUnitsGet()) {
            return;
        }

        //@formatter:off
        const commands = {
            [cmd.units.code]: (() => {
                switch (value) {
                    case this.Characteristic.TemperatureDisplayUnits.CELSIUS:    return cmd.units.value.celsius;
                    case this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT: return cmd.units.value.fahrenheit;
                }
            })()
        };
        //@formatter:on

        this.device.cmd(commands);
    }

    //endregion


    //region Swing mode

    /**
     * It uses device's {@link GreeAirConditionerCommands.swingUpDown swingUpDown} and accessory's
     * {@link isSwingingEnabled} to determine accessory's swing mode.
     *
     * @returns {@link Characteristic.SwingMode} (0 or 1 meaning <b>SWING DISABLED</b> or <b>SWING ENABLED</b>).
     */
    handleSwingModeGet(): 0 | 1 {
        if (this.device.isUnavailable()) {
            throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }

        const swingUpDown: SwUpDn = this.device.getDeviceStatus()[cmd.swingUpDown.code];

        return (this.isSwingingEnabled(swingUpDown))
            ? this.Characteristic.SwingMode.SWING_ENABLED
            : this.Characteristic.SwingMode.SWING_DISABLED;
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.swingUpDown swingUpDown} with accessory's swing mode.
     * This function returns immediately if the value to be set is the same as the one returned by
     * {@link handleSwingModeGet} or if {@link handleTargetHeaterCoolerStateGet} returns <i>null</i>.
     * <br>
     * This function will send a command to the device for setting
     * {@link GreeAirConditionerCommands.swingUpDown swingUpDown} to a predefined value based on what
     * {@link handleTargetHeaterCoolerStateGet} is returning.
     *
     * @param value Swing mode to be set.
     */
    handleSwingModeSet(value) {
        if (value === this.handleSwingModeGet()) {
            return;
        }

        const targetState: number = this.handleTargetHeaterCoolerStateGet();

        const commands = {
            [cmd.swingLeftRight.code]: cmd.swingLeftRight.value.default
        };
        //@formatter:off
        switch (value) {
            case this.Characteristic.SwingMode.SWING_DISABLED:
                commands[cmd.swingUpDown.code] = (() => {
                    switch (targetState) {
                        case this.Characteristic.TargetHeaterCoolerState.AUTO: return cmd.swingUpDown.value.default;
                        case this.Characteristic.TargetHeaterCoolerState.HEAT: return cmd.swingUpDown.value.fixedLowest;
                        case this.Characteristic.TargetHeaterCoolerState.COOL: return cmd.swingUpDown.value.fixedHighest;
                    }
                    return cmd.swingUpDown.value.default;
                })();
                break;
            case this.Characteristic.SwingMode.SWING_ENABLED:
                commands[cmd.swingUpDown.code] = (() => {
                    switch (targetState) {
                        case this.Characteristic.TargetHeaterCoolerState.AUTO: return cmd.swingUpDown.value.default;
                        case this.Characteristic.TargetHeaterCoolerState.HEAT: return cmd.swingUpDown.value.swingLowest;
                        case this.Characteristic.TargetHeaterCoolerState.COOL: return cmd.swingUpDown.value.swingHighest;
                    }
                    return cmd.swingUpDown.value.default;
                })();
                break;
        }
        //@formatter:on

        this.device.cmd(commands);
    }

    //endregion

    //endregion


    //region xFan Switch Characteristics Handlers

    /**
     * It uses device's {@link GreeAirConditionerCommands.xFan xFan} to determine accessory's <b>xFan</b> switch state.
     *
     * @returns A boolean representing whether <b>xFan</b> switch is on or off.
     */
    handleXFanGet(): boolean {
        //@formatter:off
        switch (this.device.getDeviceStatus()[cmd.xFan.code]) {
            case cmd.xFan.value.on:  return true;
            case cmd.xFan.value.off: return false;
        }
        //@formatter:on
        throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.xFan xFan} with accessory's <b>xFan</b> switch state. This
     * function returns immediately if the value to be set is the same as the one returned by
     * {@link handleXFanGet}.
     *
     * @param value <b>xFan</b> switch state to be set.
     */
    handleXFanSet(value): void {
        if (value === this.handleXFanGet()) {
            return;
        }

        this.device.cmd({[cmd.xFan.code]: value ? cmd.xFan.value.on : cmd.xFan.value.off});
    }

    //endregion

    //region Health Switch Characteristics Handlers

    /**
     * It uses device's {@link GreeAirConditionerCommands.health health} to determine accessory's <b>health</b> switch
     * state.
     *
     * @returns A boolean representing whether <b>health</b> switch is on or off.
     */
    handleHealthGet(): boolean {
        //@formatter:off
        switch (this.device.getDeviceStatus()[cmd.health.code]) {
            case cmd.health.value.on:  return true;
            case cmd.health.value.off: return false;
        }
        //@formatter:on
        throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.health health} with accessory's <b>health</b> switch state.
     * This function returns immediately if the value to be set is the same as the one returned by
     * {@link handleHealthGet}.
     *
     * @param value <b>health</b> switch state to be set.
     */
    handleHealthSet(value): void {
        if (value === this.handleHealthGet()) {
            return;
        }

        this.device.cmd({[cmd.health.code]: value ? cmd.health.value.on : cmd.health.value.off});
    }

    //endregion

    //region Light Switch Characteristics Handlers

    /**
     * It uses device's {@link GreeAirConditionerCommands.light light} to determine accessory's <b>light</b> switch
     * state.
     *
     * @returns A boolean representing whether <b>light</b> switch is on or off.
     */
    handleLightGet(): boolean {
        //@formatter:off
        switch (this.device.getDeviceStatus()[cmd.light.code]) {
            case cmd.light.value.on:  return true;
            case cmd.light.value.off: return false;
        }
        //@formatter:on
        throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.light light} with accessory's <b>light</b> switch state.
     * This function returns immediately if the value to be set is the same as the one returned by
     * {@link handleLightGet}.
     *
     * @param value <b>light</b> switch state to be set.
     */
    handleLightSet(value): void {
        if (value === this.handleLightGet()) {
            return;
        }

        this.device.cmd({[cmd.light.code]: value ? cmd.light.value.on : cmd.light.value.off});
    }

    //endregion

    //region Sleep Switch Characteristics Handlers

    /**
     * It uses device's {@link GreeAirConditionerCommands.sleep sleep} to determine accessory's <b>sleep</b> switch
     * state.
     *
     * @returns A boolean representing whether <b>sleep</b> switch is on or off.
     */
    handleSleepGet(): boolean {
        //@formatter:off
        switch (this.device.getDeviceStatus()[cmd.sleep.code]) {
            case cmd.sleep.value.on:  return true;
            case cmd.sleep.value.off: return false;
        }
        //@formatter:on
        throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.sleep sleep} with accessory's <b>sleep</b> switch state.
     * This function returns immediately if the value to be set is the same as the one returned by
     * {@link handleSleepGet}.
     *
     * @param value <b>sleep</b> switch state to be set.
     */
    handleSleepSet(value): void {
        if (value === this.handleSleepGet()) {
            return;
        }

        this.device.cmd({[cmd.sleep.code]: value ? cmd.sleep.value.on : cmd.sleep.value.off});
    }

    //endregion

    //region Quiet Switch Characteristics Handlers

    /**
     * It uses device's {@link GreeAirConditionerCommands.quiet quiet} to determine accessory's <b>quiet</b> switch
     * state.
     *
     * @returns A boolean representing whether <b>quiet</b> switch is on or off.
     */
    handleQuietGet(): boolean {
        //@formatter:off
        switch (this.device.getDeviceStatus()[cmd.quiet.code]) {
            case cmd.quiet.value.on:  return true;
            case cmd.quiet.value.off: return false;
        }
        //@formatter:on
        throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.quiet quiet} with accessory's <b>quiet</b> switch state.
     * This function returns immediately if the value to be set is the same as the one returned by
     * {@link handleQuietGet}.
     *
     * @param value <b>quiet</b> switch state to be set.
     */
    handleQuietSet(value): void {
        if (value === this.handleSleepGet()) {
            return;
        }

        let commands = {
            [cmd.quiet.code]: (() => {
                return value ? cmd.quiet.value.on : cmd.quiet.value.off
            })()
        };
        if (this.handleTurboGet()) {
            commands[cmd.turbo.code] = cmd.turbo.value.off;
        }

        this.device.cmd(commands);
    }

    //endregion

    //region Turbo Switch Characteristics Handlers

    /**
     * It uses device's {@link GreeAirConditionerCommands.turbo turbo} to determine accessory's <b>turbo</b> switch
     * state.
     *
     * @returns A boolean representing whether <b>turbo</b> switch is on or off.
     */
    handleTurboGet(): boolean {
        //@formatter:off
        switch (this.device.getDeviceStatus()[cmd.turbo.code]) {
            case cmd.turbo.value.on:  return true;
            case cmd.turbo.value.off: return false;
        }
        //@formatter:on
        throw new this.platform.api.hap.HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }

    /**
     * It sets device's {@link GreeAirConditionerCommands.turbo turbo} with accessory's <b>turbo</b> switch state.
     * This function returns immediately if the value to be set is the same as the one returned by
     * {@link handleTurboGet} or if {@link handleTargetHeaterCoolerStateGet} returns <i>null</i> or
     * {@link Characteristic.TargetHeaterCoolerState.HEAT}.
     *
     * @param value <b>turbo</b> switch state to be set.
     */
    handleTurboSet(value): void {
        if (value === this.handleSleepGet()) {
            return;
        }

        if (this.handleTargetHeaterCoolerStateGet() === this.Characteristic.TargetHeaterCoolerState.HEAT) {
            return;
        }

        let commands = {
            [cmd.turbo.code]: (() => {
                return value ? cmd.turbo.value.on : cmd.turbo.value.off
            })()
        };
        if (this.handleQuietGet()) {
            commands[cmd.quiet.code] = cmd.quiet.value.off;
        }

        this.device.cmd(commands);
    }

    //endregion


    private setAccessoryInformation(deviceContext: DeviceContext): void {
        this.accessory.getService(this.Service.AccessoryInformation)!
            .setCharacteristic(this.Characteristic.Manufacturer, deviceContext.brand)
            .setCharacteristic(this.Characteristic.Model, deviceContext.model)
            .setCharacteristic(this.Characteristic.Name, deviceContext.name)
            .setCharacteristic(this.Characteristic.SerialNumber, deviceContext.mac)
            .setCharacteristic(this.Characteristic.FirmwareRevision, deviceContext.version);
    }

    //region Handlers Binding

    private bindActiveHandlers(): void {
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.Active)
            .onGet(this.handleActiveGet.bind(this))
            .onSet(this.handleActiveSet.bind(this));
    }

    private bindCurrentHeaterCoolerStateHandlers(): void {
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.CurrentHeaterCoolerState)
            .onGet(this.handleCurrentHeaterCoolerStateGet.bind(this));
    }

    private bindTargetHeaterCoolerStateHandlers(): void {
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.TargetHeaterCoolerState)
            .onGet(this.handleTargetHeaterCoolerStateGet.bind(this))
            .onSet(this.handleTargetHeaterCoolerStateSet.bind(this));
    }

    private bindCurrentTemperatureHandlers(): void {
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.CurrentTemperature)
            .onGet(this.handleCurrentTemperatureGet.bind(this));
    }

    private bindThresholdTemperatureHandlers(): void {
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.CoolingThresholdTemperature)
            .setProps({minValue: 16, maxValue: 30, minStep: 1})
            .onGet(this.handleThresholdTemperatureGet.bind(this))
            .onSet(this.handleThresholdTemperatureSet.bind(this));
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.HeatingThresholdTemperature)
            .setProps({minValue: 16, maxValue: 30, minStep: 1})
            .onGet(this.handleThresholdTemperatureGet.bind(this))
            .onSet(this.handleThresholdTemperatureSet.bind(this));
    }

    private bindRotationSpeed(): void {
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.RotationSpeed)
            .setProps({minValue: 0, maxValue: 100, minStep: 20})
            .onGet(this.handleRotationSpeedGet.bind(this))
            .onSet(this.handleRotationSpeedSet.bind(this));
    }

    private bindTemperatureDisplayUnits(): void {
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.TemperatureDisplayUnits)
            .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
            .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));
    }

    private bindSwingMode(): void {
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.SwingMode)
            .onGet(this.handleSwingModeGet.bind(this))
            .onSet(this.handleSwingModeSet.bind(this));
    }


    private bindXFanHandlers(): void {
        this.xFanService
            .getCharacteristic(this.Characteristic.On)
            .onGet(this.handleXFanGet.bind(this))
            .onSet(this.handleXFanSet.bind(this));
    }

    private bindHealthHandlers(): void {
        this.healthService
            .getCharacteristic(this.Characteristic.On)
            .onGet(this.handleHealthGet.bind(this))
            .onSet(this.handleHealthSet.bind(this));
    }

    private bindLightHandlers(): void {
        this.lightService
            .getCharacteristic(this.Characteristic.On)
            .onGet(this.handleLightGet.bind(this))
            .onSet(this.handleLightSet.bind(this));
    }

    private bindSleepHandlers(): void {
        this.sleepService
            .getCharacteristic(this.Characteristic.On)
            .onGet(this.handleSleepGet.bind(this))
            .onSet(this.handleSleepSet.bind(this));
    }

    private bindQuietHandlers(): void {
        this.quietService
            .getCharacteristic(this.Characteristic.On)
            .onGet(this.handleQuietGet.bind(this))
            .onSet(this.handleQuietSet.bind(this));
    }

    private bindTurboHandlers(): void {
        this.turboService
            .getCharacteristic(this.Characteristic.On)
            .onGet(this.handleTurboGet.bind(this))
            .onSet(this.handleTurboSet.bind(this));
    }

    //endregion


    private refresh() {
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.Active)
            .updateValue(this.handleActiveGet());
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.handleCurrentHeaterCoolerStateGet());
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.TargetHeaterCoolerState)
            .updateValue(this.handleCurrentHeaterCoolerStateGet());
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.CurrentTemperature)
            .updateValue(this.handleCurrentTemperatureGet());
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.CoolingThresholdTemperature)
            .updateValue(this.handleThresholdTemperatureGet());
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.HeatingThresholdTemperature)
            .updateValue(this.handleThresholdTemperatureGet());
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.RotationSpeed)
            .updateValue(this.handleRotationSpeedGet());
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.TemperatureDisplayUnits)
            .updateValue(this.handleTemperatureDisplayUnitsGet());
        this.heaterCoolerService
            .getCharacteristic(this.Characteristic.SwingMode)
            .updateValue(this.handleSwingModeGet());

        this.xFanService
            .getCharacteristic(this.Characteristic.On)
            .updateValue(this.handleXFanGet());
        this.healthService
            .getCharacteristic(this.Characteristic.On)
            .updateValue(this.handleHealthGet());
        this.lightService
            .getCharacteristic(this.Characteristic.On)
            .updateValue(this.handleLightGet());
        this.sleepService
            .getCharacteristic(this.Characteristic.On)
            .updateValue(this.handleSleepGet());
        this.quietService
            .getCharacteristic(this.Characteristic.On)
            .updateValue(this.handleQuietGet());
        this.turboService
            .getCharacteristic(this.Characteristic.On)
            .updateValue(this.handleTurboGet());
    }


    /**
     * This function uses {@link isSwingingEnabledValues} to check whether the device has swinging on or off.
     *
     * @param swingUpDown Device's {@link GreeAirConditionerCommands.swingUpDown.value swingUpDown} to be checked
     * @returns A boolean representing whether the device has swinging on or off.
     * @private
     */
    private isSwingingEnabled(swingUpDown: SwUpDn): boolean {
        return this.isSwingingEnabledValues.includes(swingUpDown);
    }

}