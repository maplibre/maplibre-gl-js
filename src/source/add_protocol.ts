import {AddProtocolAction, config} from '../util/config';
import {getGlobalDispatcher} from '../util/dispatcher';

export function addProtocol(customProtocol: string, loadFn: AddProtocolAction | string) {
    if (typeof loadFn === 'string') {
        getGlobalDispatcher().broadcast('importScript', loadFn);
    } else {
        config.REGISTERED_PROTOCOLS[customProtocol] = loadFn;
    }

}

export function removeProtocol(customProtocol: string) {
    delete config.REGISTERED_PROTOCOLS[customProtocol];
}
