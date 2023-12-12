import {AddProtocolAction, config} from '../util/config';

export function addProtocol(customProtocol: string, loadFn: AddProtocolAction) {
    config.REGISTERED_PROTOCOLS[customProtocol] = loadFn;
}

export function removeProtocol(customProtocol: string) {
    delete config.REGISTERED_PROTOCOLS[customProtocol];
}

export function getProtocol(url: string) {
    return config.REGISTERED_PROTOCOLS[url.substring(0, url.indexOf('://'))]
}
