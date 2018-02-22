#!/usr/bin/env node

/*
 *  This code is under MIT licence, you can find the complete file here:
 *  https://github.com/WilderBase/wilderbase_core/blob/master/LICENSE
 */

/*
 * Class:           Daemonizer
 * Description:     Allow the Wilderbase client to execute as a background
 *                  process, without a console or other front end
 */

function Daemonizer() {
}

Daemonizer.prototype.spawnDaemon = function() {

    // TODO:
    // Add a check here to determine whether the daemon is already running
    // If so, then log the error and exit

    // Is this the O/S level (parent) instance of this program?
    if (process.env.isSpawned == null) {
    
        // Yes: Toggle this flag so that the next execution of this code will
        // be treated as the child instance and this block of code will not be traversed
        process.env.isSpawned = true;
        
        // Prepare inputs for the child process
        var argsLocal = [].concat(process.argv);
        argsLocal.shift();
        var childOptions = {
            stdio: ['ignore', process.stdout, process.stderr],
            cwd: process.cwd,
            detached: true
        };
    
        // Spawn the daemon process and detach it from the parent
        var child_process = require('child_process');
        var daemonProcess = child_process.spawn(process.execPath, argsLocal, childOptions);
        daemonProcess.unref();

        // Exit the parent process that was invoked at the O/S level
        process.exit();
    }
}

Daemonizer.prototype.runDaemon = function(opt) {

    // Start running the base engine in the spawned daemon 
    opt.baseEngine.run(opt);
}



/*
 * Beginning of code to instantiate and run the WilderBase host program
 * as a service at the O/S level
 */

// Use fAbort = true to avoid running this service,
// even though /etc/init/wb_base_engine.conf calls this script

var fAbort = false;
//var fAbort = true;

if (fAbort == false) {

    var wb_base_engine = require('./wb_base_engine.js');
    var daemonizer = new Daemonizer();

    // Run the O/S level (parent) instance of this program which spawns a child
    // instance to run in the background, detached from any console or startup script
    daemonizer.spawnDaemon();

    // Only the child instance of this code gets to this point, where it
    // runs indefinitely as a background service
    var stage = 'dev';
    var wbBaseEngine = new wb_base_engine.WBBaseEngine(stage);
    var optDaemon = {
        dirLog: '/var/log/wb/' + stage + '/',
        dirData: '/var/lib/wb/' + stage + '/wb_base_engine',
        baseEngine: wbBaseEngine
    };
    daemonizer.runDaemon(optDaemon);
}

/*
 * End of code to run the WilderBase host service
 */

