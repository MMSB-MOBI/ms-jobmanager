import {profileInterface} from './index.js'

const WS_DEFAULT_BIN = {
    "submitBin" : "/usr/bin/sbatch",
    "cancelBin" : "/usr/bin/scancel",
    "queueBin"  : "/usr/bin/squeue"
}

const engineSys = {
    "comments": "Definition of specific submission/kill binaries and intermediary cache folders",
    "definitions": {
        "crispr-dev": {
            "binaries": {
                "submitBin" : "/data/www_dev/crispr/bin/slurm/bin/sbatch",
                "cancelBin" : "/data/www_dev/crispr/bin/slurm/bin/scancel",
                "queueBin"  : "/data/www_dev/crispr/bin/slurm/bin/squeue"
            },
            "iCache" : "crispr/tmp"
        },
        "mad-dev": {
            "binaries": {
                "submitBin" : "/data/www_dev/mad/bin/slurm/bin/sbatch",
                "cancelBin" : "/data/www_dev/mad/bin/slurm/bin/scancel",
                "queueBin"  : "/data/www_dev/mad/bin/slurm/bin/squeue"
            },
            "iCache" : "mad/tmp"
        },
        "cstb-prod": {
            "binaries": {
                "submitBin" : "/data/www/cstb/bin/slurm/bin/sbatch",
                "cancelBin" : "/data/www/cstb/bin/slurm/bin/scancel",
                "queueBin"  : "/data/www/cstb/bin/slurm/bin/squeue"
            },
            "iCache" : "cstb/tmp"
        },
        "mad-prod": {
            "binaries": {
                "submitBin" : "/data/www/mad/bin/slurm/bin/sbatch",
                "cancelBin" : "/data/www/mad/bin/slurm/bin/scancel",
                "queueBin"  : "/data/www/mad/bin/slurm/bin/squeue"
            },
            "iCache" : "mad/tmp"
        }, 
        "ws2-dev-mad" : {
            "binaries": WS_DEFAULT_BIN,
            "iCache" : "dev/mad/tmp",
            "execUser" : "ws_mad"
        },
        "ws2-prod-mad" : {
            "binaries": WS_DEFAULT_BIN,
            "iCache" : "prod/mad/tmp",
            "execUser" : "ws_mad"
        },
        "dev-cstb" : {
            "binaries": WS_DEFAULT_BIN,
            "iCache" : "dev/cstb/tmp",
            "execUser" : "ws_cstb"
        },
        "ws2-prod-cstb" : {
            "binaries": WS_DEFAULT_BIN,
            "iCache" : "prod/cstb/tmp",
            "execUser" : "ws_cstb"
        },
        "ws2-dev-detbelt" : {
            "binaries": WS_DEFAULT_BIN,
            "iCache" : "dev/detbelt/tmp",
            "execUser" : "ws_detbelt"
        },
        "ws2-prod-detbelt" : {
            "binaries": WS_DEFAULT_BIN,
            "iCache" : "prod/detbelt/tmp/",
            "execUser" : "ws_detbelt"
        }
    }
}; 

const profiles: profileInterface = {
    "comments": "Definition of slurms set of preprocessors options values",
    "definitions": {
        "ifb-slurm": {
        },
        "default": {
            "partition": "short"
        },
        "crispr-dev": {
            "partition": "ws-dev",
            "qos": "ws-dev",
            "gid": "ws_users",
            "uid": "ws_crispr"
        },
        "mad-dev": {
            "partition": "ws-dev",
            "qos": "ws-dev",
            "gid": "ws_users",
            "uid": "ws_mad"
        },
        "arwen_gpu": {
            "partition": "gpu_dp",
            "qos": "gpu"
        },
        "arwen_cpu": {
            "partition": "mpi",
            "qos": "mpi"
        },
        "arwen_express": {
            "partition": "express",
            "qos": "express"
        },
        "arwen-dev_gpu": {
            "partition": "gpu",
            "qos": "gpu",
            "gid": "ws_users",
            "uid": "ws_ardock"
        },
        "arwen-dev_cpu": {
            "partition": "ws-dev",
            "qos": "ws-dev",
            "gid": "ws_users",
            "uid": "ws_ardock"
        },
        "arwen-prod_cpu": {
            "partition": "ws-prod",
            "qos": "ws-prod",
            "gid": "ws_users",
            "uid": "ws_ardock"
        },
        "arwen-dev_hex_16cpu": {
            "partition": "ws-dev",
            "qos": "ws-dev",
            "gid": "ws_users",
            "uid": "ws_ardock",
            "nNodes": '1',
            "nCores": '16'
        },
        "arwen-prod_hex_16cpu": {
            "partition": "ws-prod",
            "qos": "ws-prod",
            "gid": "ws_users",
            "uid": "ws_ardock",
            "nNodes": '1',
            "nCores": '16'
        },
        "arwen_hex_16cpu": {
            "partition": "mpi",
            "qos": "mpi",
            "nCores": '16'
        }, 
        "slurm_error":{
            "partition": "toto",
            "qos" : "toto"
        },
        "cstb-prod":{
            "partition": "ws-prod",
            "qos": "ws-prod",
            "gid": "ws_users",
            "uid": "ws_cstb"
        },
        "mad-prod":{
            "partition": "ws-prod",
            "qos": "ws-prod",
            "gid": "ws_users",
            "uid": "ws_mad"
        },
        "ws2-short": {
            "partition" : "short",
            "addToBash" : ". /etc/profile" //to allow user to execute
        },
        "ws2-long" : {
            "partition" : "long",
            "addToBash" : ". /etc/profile" //to allow user to execute
        },
	"debian-short" : {
	   "partition" : "debian_short",
	   "addToBash" : ". /etc/profile" 
	}
    }
}

export {profiles, engineSys};

