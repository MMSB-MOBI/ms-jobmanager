import {logger} from '../../../logger.js';
import { stringMap, isStringMap, isArrayOfString } from '../../../shared/types/base';


/*
{
    "comments": "Definition of local set of preprocessors options values",
    "definitions": {
        "default": {
            "WORKDIR": "$PWD",// to mimic other engines : specify a workdir
            "user": "buddy",
            "system": "nix",
            "waitingTime": "10",
        }
    },
    "actions" : {
        "default": [ "printenv"]
    },
*/


type profileAction = { [s:string] :  string[] };

export interface profileDefinition {
    [s:string] : stringMap;
}

export interface profileInterface {
    comments    : string;
    definitions : profileDefinition;
    actions?    : profileAction;

}

export function isProfile(obj: any): obj is profileInterface {
    if(typeof(obj) != 'object') return false;
    if(!obj.hasOwnProperty('comments')) return false;
    if(!obj.hasOwnProperty('definitions')) return false;

    for(let key in obj.defintions){
        if(typeof(key) != 'string') return false;
        if(!isStringMap(obj[key])) return false;
    }
    if(obj.hasOwnProperty('actions'))
        for(let key in obj.actions)
           if (!isArrayOfString(obj.actions[key]))
                return false;
            
    return true;
}

export function defaultGetPreprocessorString (profileKey:string|undefined, profileContainer:profileInterface):string {
    const [varDefs, actionsDef] = defaultGetPreprocessorContainer(profileKey, profileContainer);
    let string:string = _preprocessorDump(varDefs, actionsDef);
    string += "export JOBPROFILE=\"" + profileKey + "\"\n";
    return string;
}

export const defaultGetPreprocessorContainer = (profileKey:string|undefined, profileContainer:profileInterface):[ stringMap, undefined|string[] ] => { 
    logger.error("->>>>>OOOOO>>" + profileKey);
    if (!profileKey){
        logger.warn(`profile key undefined, using "default"`);
        profileKey = "default";
    }
    else if (!profileContainer.definitions.hasOwnProperty(profileKey)) {
        logger.error(`profile key ${profileKey} unknown, using "default"`);
        profileKey = "default";
    }
    return [ profileContainer.definitions[profileKey], profileContainer.actions?.[profileKey] ];
}

function _preprocessorDump (vars:stringMap, actions?:string[]):string {
    let str = '';
    logger.error("->>>>>>>" + actions);
    for (let sym in vars)
        str += `export ${sym}=${vars[sym]}\n`;
    if(actions)
        actions.forEach ( action => str += `${action} >> .preprocess.out`);
    return str;
}
 