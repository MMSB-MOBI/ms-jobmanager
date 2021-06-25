import {profileInterface} from './index.js'

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
            "binaries": {
                "submitBin" : "/usr/bin/sbatch",
                "cancelBin" : "/usr/bin/scancel",
                "queueBin"  : "/usr/bin/squeue"
            },
            "iCache" : "mad",
            "execUser" : "ws_mad"
        },
        "ws2-dev-mad2" : {
            "binaries": {
                "submitBin" : "/usr/bin/sbatch",
                "cancelBin" : "/usr/bin/scancel",
                "queueBin"  : "/usr/bin/squeue"
            },
            "iCache" : "mad"
        },
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
        "ws2-dev-mad": {
            "partition" : "short"
        }
    }
}

export {profiles, engineSys};
