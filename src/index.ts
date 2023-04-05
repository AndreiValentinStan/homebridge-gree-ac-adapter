import {API} from 'homebridge';

import {PLATFORM_NAME} from './settings';
import {GreeAirConditionerPlatform} from "./gree/GreeAirConditionerPlatform";

export = (api: API) => {
    api.registerPlatform(PLATFORM_NAME, GreeAirConditionerPlatform);
};
