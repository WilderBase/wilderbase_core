/*
 *  This code is under MIT licence, you can find the complete file here:
 *  https://github.com/WilderBase/wilderbase_core/blob/master/LICENSE
 */

"use strict";

var wb_interface = (typeof exports === "undefined") ? this.wb_interface = {} : exports;

/*
 *  Class:           Session
 *  Description:     Client-server session
 */

wb_interface.Session = Session;

function Session() {
    this.semantoStacks = {};
}

