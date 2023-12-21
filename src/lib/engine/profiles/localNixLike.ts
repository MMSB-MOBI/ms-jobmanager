const profiles = {
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
    "dummy": {
        "WORKDIR": "$PWD",// to mimic other engines : specify a workdir
        "user": "buddy",
        "system": "nix",
        "waitingTime": "10"
    },
    "iCache-test": {
        "WORKDIR": "$PWD",// to mimic other engines : specify a workdir
        "user": "buddy",
        "system": "nix",
        "waitingTime": "10",
        "iCache": "my_icache"
    }
};


const engineSys = {
    "comments": "Definition of specific submission/kill binaries and intermediary cache folders",
    "definitions": {
        "iCache-test": {
            "iCache": "my_icache"
        }
    }
};
export { engineSys, profiles };
