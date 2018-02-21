/*
 *  This code is under MIT licence, you can find the complete file here:
 *  https://github.com/WilderBase/wilderbase_core/blob/master/LICENSE
*/

var wb_base_engine = exports;

var fLogCPPOutput = 
false; //true;
var fDigitalCertsFake = 
true;

var globDigitalCertDomain = 'www_wilderbase_com';
var globFileKey = (fDigitalCertsFake) ? '/etc/ssl/private/server.key' : '/etc/ssl/private/' + globDigitalCertDomain + '.key';
var globFileCert = (fDigitalCertsFake) ? '/etc/ssl/certs/server.crt' : '/etc/ssl/certs/' + globDigitalCertDomain + '.crt';

var globPortListenHttpClear = '80';
var globPortListenHttpSSL = '443';
var globPortListenWebsocket = '8080';
var globBaseEngine = null;
var globDataStore = null;
var globDbDatabaseNameApplications = 'wb_applications';
var globDbURLMongo = 'mongodb://localhost:27017/' + globDbDatabaseNameApplications;
var globDbConnectionPoolSize = 6;

const http = require('http');
const https = require('https');
const WebSocket = require('/usr/lib/node_modules/ws');
const sqlite3 = require('sqlite3').verbose();
var MongoClient = require('/usr/lib/node_modules/mongodb').MongoClient;
var ObjectID = require('/usr/lib/node_modules/mongodb').ObjectID;
var fs = require('fs');
var url = require('url');
var querystring = require('/usr/lib/node_modules/querystring');
var randomstring = require("/usr/lib/node_modules/randomstring");
var assert = require('/usr/lib/node_modules/assert');

var https_options = {
	key  : fs.readFileSync(globFileKey),
	cert : fs.readFileSync(globFileCert)
};

/*
Class:            WBBaseEngine
Description:      Drive the usage of a Wilderbase server
*/

wb_base_engine.WBBaseEngine = WBBaseEngine;

function WBBaseEngine(stage) {
    this.stage = stage;
    globBaseEngine = this;
}

WBBaseEngine.prototype.run = function(opt) {
    this.dirLog = opt.dirLog;
    this.dirData = opt.dirData;
    this.wsConnections = {};
    this.appControllers = {};
    
    // Acquire the data store for persistent storage
    globDataStore = new WBDataStore();

    // Create a websocket server
    var httpServerWS = https.createServer(https_options, functionHttpServerWS);
    httpServerWS.listen(globPortListenWebsocket);
    this.wss = new WebSocket.Server({ server: httpServerWS });

    // Websocket server connection event handler
    this.wss.on('connection', functionWssOnConnection);
    
    // Create an http server
    this.httpServer = http.createServer(functionHttpServer);
    this.httpServer.listen(globPortListenHttpClear);
    
    // Create an https server
    this.httpsServer = https.createServer(https_options, functionHttpsServer);
    this.httpsServer.listen(globPortListenHttpSSL);
    
    console.log("\nWBBaseEngine started ......\n");
    
}

function functionHttpServer(request, response){
    var dateCur = new Date();
    console.log("Date: " + dateCur.toUTCString());
    for (var i in request.headers) {
        console.log(i + ' = ' + request.headers[i]);
    }
    var pathname = url.parse(request.url).pathname;
    var redirectURL = "https://" + request.headers.host + request.url;
    console.log("Request path (HTTP): " + pathname);
    console.log("Request CONN rmt addr: " + request.connection.remoteAddress);
    console.log("Redirecting to: " + redirectURL + "\n");
    response.writeHead(302,  {Location: redirectURL})
    response.end();
}

function functionHttpsServer(request, response){
    var dateCur = new Date();
    console.log("Date: " + dateCur.toUTCString());
    for (var i in request.headers) {
        console.log(i + ' = ' + request.headers[i]);
    }
    var pathname = url.parse(request.url).pathname;
    var query = url.parse(request.url,true).query;
    console.log("Request path: " + pathname);
    console.log("Request conn rmt addr: " + request.connection.remoteAddress + "\n");
    var responseContent;
    if (request.headers['host'] != null && (request.headers['host'].toLowerCase() =='wilderbase.com' ||
            request.headers['host'].toLowerCase() =='www.wilderbase.com' )) {
        response.writeHead(200, {'Content-Type': 'text/html'});
        responseContent = 'We apologize. The website is down for maintenance.';
    } else if (pathname == "/wilderbase.js") {
        response.writeHead(200, {'Content-Type': 'text/javascript'});
        responseContent = fs.readFileSync('./wilderbase.js');
    } else if (pathname == "/wb_interface.js") {
        response.writeHead(200, {'Content-Type': 'text/javascript'});
        responseContent = fs.readFileSync('/usr/lib/node_modules/wilderbase/wb_interface.js');
    } else if (pathname.substring(0, 8) == "/images/") {
        response.writeHead(200, {'Content-Type': 'image/png'});
        responseContent = fs.readFileSync('.' + pathname);
    } else if (pathname.substring(0, 20) == "/static/js/bundle.js") {
        response.writeHead(200, {'Content-Type': 'text/javascript'});
        responseContent = fs.readFileSync('./build' + pathname);
    } else if (pathname.substring(0, 11) == "/bundle.map") {
        response.writeHead(200, {'Content-Type': 'application/json'});
        responseContent = fs.readFileSync('./build' + pathname);
    } else if (pathname.substring(0, 14) == "/static/media/") {
        response.writeHead(200, {'Content-Type': 'application/x-opentype'});
        responseContent = fs.readFileSync('./build' + pathname);
    } else if (pathname.substring(0, 13) == "/sockjs-node/") {
        response.writeHead(404, {'Content-Type': 'text/html'});
        responseContent = '';
    } else if (pathname.substring(0, 5) == "/css/") {
        response.writeHead(200, {'Content-Type': 'text/css'});
        responseContent = fs.readFileSync('.' + pathname);
    } else if (pathname.substring(0, 4) == "/js/") {
        response.writeHead(200, {'Content-Type': 'text/javascript'});
        responseContent = fs.readFileSync('.' + pathname);
    } else if (pathname.substring(0, 7) == "/fonts/") {
        response.writeHead(200, {'Content-Type': 'application/x-opentype'});
        responseContent = fs.readFileSync('.' + pathname);
    } else if (pathname.substring(0, 8) == "/action/") {
        response.writeHead(200, {'Content-Type': 'application/json'});
        responseContent = JSON.stringify(actionResponse(pathname.substring(8)));
        var connectionId = '';
        if (globBaseEngine.wsConnections[connectionId] != null) {
            var appId = globBaseEngine.wsConnections[connectionId].appId;
            if (globBaseEngine.appControllers[appId] != null) {
                appControllerCur = globBaseEngine.appControllers[appId];
                
                // This is a Restful call, so fSynchronous = true
                appControllerCur.serveConnection(connectionId, true, functionHttpsServer_ActionAsync, request, response);
            }
        }

        return;

    } else {                                // Request for Initial html
        var appMnemonic = '';
        if (request.headers.host != null) {
            var posDot = request.headers.host.indexOf('.');
            appMnemonic = request.headers.host.substring(0, posDot);
        }
        if (appMnemonic == '') {
            appMnemonic = request.url.substring(1);
        }
        var appId;
        if (globDataStore.appsByMnemonic[appMnemonic] != null) {
            appId = globDataStore.appsByMnemonic[appMnemonic].appId;
            functionHttpsServer_InitialHtml(request, response, appId, appMnemonic);
        } else {
            globDbHandleMongo.collection("applications").findOne(
                {appMnemonic: appMnemonic},
                function(err, result) {
                    if (err) throw err;
                    console.log("getAppIdByMnemonic(): " + JSON.stringify(result));
                    if (result != null) {
                        var resultFirst = result;
                        globDataStore.appsByMnemonic[appMnemonic] = {appId: resultFirst.appId, appMnemonic: resultFirst.appMnemonic};
                        appId = globDataStore.appsByMnemonic[appMnemonic].appId;
                    }
                    functionHttpsServer_InitialHtml(request, response, appId, appMnemonic);
                }
            );
        }
        // Early return from this function call
        // Chaining on to promised/callback function: functionHttpsServer_InitialHtml()
        return;
    }
    response.write(responseContent);
    response.end();
}

function functionHttpsServer_ActionAsync(request, response){
    response.write('Some Stuff');
    response.end();
}

function functionHttpsServer_InitialHtml(request, response, appId, appMnemonic) {
    var responseContent;
    if (appId != null) {
        var remoteAddress = request.connection.remoteAddress;
        var connectionIdNew;
        var dateISO = new Date().toISOString();
        var dateString = dateISO[2]+dateISO[3] + dateISO[5]+dateISO[6] + dateISO[8]+dateISO[9] +
            dateISO[11]+dateISO[12] + dateISO[14]+dateISO[15] + dateISO[17]+dateISO[18];
        do {
            connectionIdNew = dateString + randomstring.generate({length:20});
        } while (globBaseEngine.wsConnections[connectionIdNew] != null);
        globBaseEngine.wsConnections[connectionIdNew] = {
            connectionId: connectionIdNew,
            requestUrl: request.url,
            appMnemonic: appMnemonic,
            appId: appId,
            remoteAddress: remoteAddress,
            requestHeaders: request.headers,
            WBAppSession: new WBAppSession(connectionIdNew)
        };
        response.writeHead(200, {'Content-Type': 'text/html', 'ConnectionId': connectionIdNew});
        var htmlText = fs.readFileSync('./build/index.html');
        responseContent = htmlText.toString().replace('CONNECTION_ID', connectionIdNew);
        var appControllerCur;
        if (globBaseEngine.appControllers[appId] != null) {
             appControllerCur = globBaseEngine.appControllers[appId];
        } else {
             appControllerCur = new WBAppController(appId);
             globBaseEngine.appControllers[appId] = appControllerCur; 
        }
        appControllerCur.addConnection(connectionIdNew, globBaseEngine.wsConnections[connectionIdNew]);
    } else {
        responseContent = '<html><head>Wilderbase</head><body>App: ' + appMnemonic + ' not found</body></html>';
    }
    response.write(responseContent);
    response.end();
}

function functionHttpServerWS(req, res) {
    console.log("WS Request received.");
}

function functionWssOnConnection(ws) {
    console.log("WS connection started.");
    ws.on('message',
        function incoming(message) {
            var messageIn = JSON.parse(message);
            var connectionIdIn = messageIn.connectionId;
            if (globBaseEngine.wsConnections[connectionIdIn] != null) {
                if (globBaseEngine.wsConnections[connectionIdIn].socket == null) {
                    globBaseEngine.wsConnections[connectionIdIn].socket = ws;
                }
                var messageEnvelope = {};
                messageEnvelope.connectionId = messageIn.connectionId;
                if (messageIn.action != null) {
                    messageEnvelope.action = messageIn.action;
                }
                if (messageIn.Session != null) {
                    messageEnvelope.Session = messageIn.Session;
                }
                messageEnvelope.host = globBaseEngine.wsConnections[connectionIdIn].host;
                messageEnvelope.requestHeaders = globBaseEngine.wsConnections[connectionIdIn].requestHeaders;
                messageEnvelope.requestUrl = globBaseEngine.wsConnections[connectionIdIn].requestUrl;
                messageEnvelope.remoteAddress = globBaseEngine.wsConnections[connectionIdIn].remoteAddress;
                console.log("From Client:\n" + JSON.stringify(messageEnvelope) + "\n");

                if (globBaseEngine.wsConnections[connectionIdIn] != null) {
                    var appId = globBaseEngine.wsConnections[connectionIdIn].appId;
                    if (globBaseEngine.appControllers[appId] != null) {
                        appControllerCur = globBaseEngine.appControllers[appId];
                        
                        // This is a websocket call, so fSynchronous = false
                        appControllerCur.serveConnection(connectionIdIn, false, functionWssOnConnection_ActionAsync, messageEnvelope, null);
                    }
                }
            }
        }
    );
    
    ws.on('close',
        function closing() {
            console.log("WS connection closed.");
            for (var i in globBaseEngine.wsConnections) {
                if (globBaseEngine.wsConnections[i].socket != null && globBaseEngine.wsConnections[i].socket == ws) {
                    globBaseEngine.wsConnections[i].socket = null;
                    var messageEnvelope = {};
                    messageEnvelope.action = "Close";
                    messageEnvelope.connectionId = i;
                }
            }
        }
    );
}

function functionWssOnConnection_ActionAsync(connectionIdIn, messageOutObject) {
    var messageOutContent = JSON.stringify(messageOutObject);
    globBaseEngine.wsConnections[connectionIdIn].socket.send(messageOutContent);
    console.log("To Client:\n" + messageOutContent + " ......\n");
}

/*
Class:            WBDataStore
Description:      Persistent data storage and retrieval facility
*/

function WBDataStore() {
    this.appsByMnemonic = {};
    MongoClient.connect(
        globDbURLMongo,
        {poolSize: globDbConnectionPoolSize},
        function(err, db) {
            assert.equal(null, err);
            globDbHandleMongo = db;
            console.log("Connected to mongodb server: " + globDbURLMongo +" \n");
        }
    );
}

/*
Class:            WBAppController
Description:      Drive the usage of a Wilderbase application
*/

function WBAppController(appId) {
    this.appId = appId;
    this.fLocal = true;
    this.connections = {};
    this.sessions = {};
    this.dbbURLMongo = 'mongodb://localhost:27017/wb_' + this.appId;
    this.dbHandleMongo = null;
    MongoClient.connect(
        this.dbbURLMongo,
        {poolSize: 2},
        (err, db) => {
            assert.equal(null, err);
            globBaseEngine.appControllers[appId].dbHandleMongo = db;
            console.log("AppId: " + appId +" \n");
            console.log("Connected to mongodb server: " + this.dbbURLMongo +" \n");
        }
    );
}

WBAppController.prototype.addConnection = function(connectionId, connection) {
    this.connections[connectionId] = connection;
    this.sessions[connectionId] = {};
}

WBAppController.prototype.serveConnection = function(connectionId, fSynchronous, function_ActionAsync, paramRequest, paramResponse) {
    var wbAppSessionCur = globBaseEngine.wsConnections[connectionId].WBAppSession;
    var sessionAction = '';
    if (paramRequest.Session != null && paramRequest.Session.Action != null) {
        sessionAction = paramRequest.Session.Action;
    }
    switch (sessionAction) {
        case 'StackSpawn':
            wbAppSessionCur.spawnStack(this, function_ActionAsync, paramRequest, 0);
            break;
        case 'StackUse':
            wbAppSessionCur.useStack(this, function_ActionAsync, paramRequest);
            break;
    }
}

/*
Class:            WBAppSession
Description:      Drive the use of an App session
*/

function WBAppSession(sessionId) {
    this.sessionId = sessionId;
    this.WBStacks = [];
}

WBAppSession.prototype.spawnStack = function(wbAppController, function_ActionAsync, paramRequest, stackId) {
    var paramResponseLocal = {
        connectionId: this.sessionId,
        AppMnemonic: globBaseEngine.wsConnections[this.sessionId].appMnemonic,
        Session: {}
    };
    var stackIdLocal = stackId;
    var stackNew = new WBStack(stackId);
    this.WBStacks[stackId] = stackNew;
    var templateName;
    if (true) { // Replace with app discovery code
        templateName = "Home";
    }
    var query = {};
    query[templateName] = {$ne:null};
    wbAppController.dbHandleMongo.collection("WB_Templates").find(query).toArray(
        function(err, result) {
            if (err) throw err;
            if (result != null) {
                if (result.length == 1 && result[0][templateName] != null) {
                    paramResponseLocal.Session.AppName = paramResponseLocal.AppMnemonic;
                    paramResponseLocal.Session.Action = 'StackSpawn';
                    paramResponseLocal.Session.StackNew = {Id: stackIdLocal};
                    paramResponseLocal.Session.StackNew.TemplateName = templateName;
                    paramResponseLocal.Session.StackNew.Template = result[0][templateName];
                    paramResponseLocal.Session.StackNew.Content = {Seed:{ItemSeed: {}}};
                    stackNew.templateName = paramResponseLocal.Session.StackNew.TemplateName;
                    stackNew.template = paramResponseLocal.Session.StackNew.Template;
                    stackNew.content = paramResponseLocal.Session.StackNew.Content;
                }
                function_ActionAsync(paramResponseLocal.connectionId, paramResponseLocal);
            }
        }
    );
}

WBAppSession.prototype.destroyStack = function(stackId) {
}

WBAppSession.prototype.useStack = function(wbAppController, function_ActionAsync, paramRequest) {
    var paramResponseLocal = {
        connectionId: this.sessionId,
        AppMnemonic: globBaseEngine.wsConnections[this.sessionId].appMnemonic,
        Session: {
            Action: 'StackUse',
            Stack: {}
        }
    };
    var stackId = -1;
    if (paramRequest.Session.Stack.Id != null) {
        stackId = paramRequest.Session.Stack.Id;
    }
    if (stackId >= 0 && this.WBStacks[stackId] != null) {
        this.WBStacks[stackId].processRequest(wbAppController, function_ActionAsync, paramResponseLocal,
            paramRequest.Session.Stack, paramResponseLocal.Session.Stack);
    }
}

WBAppSession.prototype.invoke = function(wbAppController, function_ActionAsync, paramRequest) {
}

WBAppSession.prototype.provoke = function(wbAppController, function_ActionAsync, paramRequest) {
    // Take the revision path and find matching nodes on the
    // session tree.  These are other sessions that are watching
    // the provoked/changes nodes.
    // Evoke those sessions
    console.log("Provoke ...\n");
}

WBAppSession.prototype.evoke = function(wbAppController, function_ActionAsync, paramRequest) {
    // Call functionWssOnConnection_ActionAsync(connectionIdIn, messageOutObject)
    console.log("Evoke ...\n");
}

/*
Class:            WBStack
Description:      Drive the use of an execution thread in a session
*/

function WBStack(stackId) {
    this.stackId = stackId;
    this.templateName = null;
    this.template = null;
    this.content = null;
    this.WBStackFrames = [];
    
}

WBStack.prototype.processRequest = function(wbAppController, function_ActionAsync, paramResponse_Base, paramRequest_Stack, paramResponse_Stack) {
    if (paramRequest_Stack.Id != null) {
        paramResponse_Stack.Id = paramRequest_Stack.Id;
    }
    if (paramRequest_Stack.Action != null) {
        paramResponse_Stack.Action = paramRequest_Stack.Action;
        switch(paramRequest_Stack.Action) {
            case 'FramePush':
            
                /*
                // HERE:
                //
                // [ Actions received from f/e update:
                //   - Session tree and Sessions collection in DB
                //   - WatchTree
                //   - Collections in DB
                //   - Templates and Users - special Admin actions
                // ]
                // = Sessions
                //   - User
                //   = Stacks
                //     = Frames
                //       - Context
                //       - Projection
                // - WatchTree 
                //     [ nodes point to sessions watching them ]
                // = Revisions 
                //     [ check revisions against WatchTree and evoke to watching sessions ]
                // = Templates
                // = Users
                // = Collections
                // = Indexes (may get rolled into Collections)
                */
                
                var frameNewId = this.WBStackFrames.length;
                var frameNew = new WBStackFrame(frameNewId);
                this.WBStackFrames[frameNewId] = frameNew;
                paramResponse_Stack.FrameNew = {Id: frameNewId};
                if (paramRequest_Stack.Content != null) {
                    paramResponse_Stack.Content = paramRequest_Stack.Content;
                    frameNew.content = paramResponse_Stack.Content;
                }
                if (paramRequest_Stack.Frame != null) {
                    frameNew.WBContext.Path = {};
                    if (paramRequest_Stack.Frame.CellPath != null) {
                        frameNew.WBContext.Path = {};
                        frameNew.WBContext.Path[paramRequest_Stack.Frame.CellPath] = {};
                    }
                    var collectionLocal;
                    if (paramRequest_Stack.Frame.Action != null && Object.keys(frameNew.WBContext.Path).length > 0) {
                        collectionLocal = Object.keys(frameNew.WBContext.Path)[0];
                        if (this.template.Terms != null &&
                            this.template.Terms[collectionLocal] != null &&
                            this.template.Terms[collectionLocal].Template != null &&
                            this.template.Terms[collectionLocal].Template.Nested != null &&
                            this.template.Terms[collectionLocal].Template.Nested.Actions != null &&
                            this.template.Terms[collectionLocal].Template.Nested.Actions[paramRequest_Stack.Frame.Action] != null &&
                            this.template.Terms[collectionLocal].Template.Nested.Actions[paramRequest_Stack.Frame.Action].Nested != null
                            ) {
                            frameNew.template = this.template.Terms[collectionLocal].Template.Nested.Actions[paramRequest_Stack.Frame.Action].Nested;
                        }
                    }
                    frameNew.processRequest(wbAppController, function_ActionAsync, paramResponse_Base,
                        paramRequest_Stack.Frame, paramResponse_Stack.FrameNew);
                }
                break;
            case 'FrameUse':
                if (paramRequest_Stack.Frame != null && paramRequest_Stack.Frame.Id != null) {
                    paramResponse_Stack.Frame = {Id: paramRequest_Stack.Frame.Id};
                    if (this.WBStackFrames[paramRequest_Stack.Frame.Id] != null) {
                        var frameCur = this.WBStackFrames[paramRequest_Stack.Frame.Id];
                        if (paramRequest_Stack.Frame.Action != null && 
                            (paramRequest_Stack.Frame.Action == 'Cancel' || paramRequest_Stack.Frame.Action == 'Create' || paramRequest_Stack.Frame.Action == 'Update')) {
                            if (paramRequest_Stack.Frame.Id > 0 && this.WBStackFrames.length > paramRequest_Stack.Frame.Id) {
                                this.WBStackFrames = this.WBStackFrames.splice(0, this.WBStackFrames.length-paramRequest_Stack.Frame.Id);
                            }
                        }
                        frameCur.processRequest(wbAppController, function_ActionAsync, paramResponse_Base,
                            paramRequest_Stack.Frame, paramResponse_Stack.Frame);
                    }
                }
                break;
        }
    }
}

/*
Class:            WBStackFrame
Description:      Drive one node in the call tree of thread execution
*/

function WBStackFrame(stackFrameId) {
    this.stackFrameId = stackFrameId;
    this.templateName = null;
    this.template = null;
    this.content = null;
    this.WBContext = {};
    this.WBProjection = {};
}

WBStackFrame.prototype.processRequest = function(wbAppController, function_ActionAsync, paramResponse_Base, paramRequest_Frame, paramResponse_Frame) {
    if (paramRequest_Frame.Action != null) {
        paramResponse_Frame.Action = paramRequest_Frame.Action;
        switch (paramRequest_Frame.Action) {
            case 'Create':
                if (paramRequest_Frame.DataEntered != null) {
                    var collectionLocal = Object.keys(this.WBContext.Path)[0];
                    var queryTerm = paramRequest_Frame.DataEntered;
                    wbAppController.dbHandleMongo.collection(collectionLocal).insertOne(queryTerm,
                        function(err, result) {
                            if (err) throw err;
                            if (result != null) {
                                paramResponse_Frame.Content = {Seed:{ItemSeed: {}}};
                                paramResponse_Frame.Content.Seed.ItemSeed[collectionLocal] = [];
                                paramResponse_Frame.Content.Seed.ItemSeed[collectionLocal][0] = queryTerm;
                                paramResponse_Frame.CellPath = collectionLocal;
                                function_ActionAsync(paramResponse_Base.connectionId, paramResponse_Base);
                            }
                        }
                    );
                }
                break;
            case 'Update':
                if (paramRequest_Frame.DataEntered != null && Object.keys(paramRequest_Frame.DataEntered).length > 0 &&
                        paramRequest_Frame.ObjectId != null) {
                    var collectionLocal = Object.keys(this.WBContext.Path)[0];
                    var queryTerm = {};
                    wbAppController.dbHandleMongo.collection(collectionLocal).updateOne(
                        {_id: ObjectID(paramRequest_Frame.ObjectId)},
                        {$set: paramRequest_Frame.DataEntered},
                        function(err, result) {
                            if (err) throw err;
                            if (result != null) {
                                paramResponse_Frame.Content = {Seed:{ItemSeed: {}}};
                                paramResponse_Frame.Content.Seed.ItemSeed[collectionLocal] = [];
                                paramResponse_Frame.Content.Seed.ItemSeed[collectionLocal][0] = paramRequest_Frame.DataEntered;
                                paramResponse_Frame.Content.Seed.ItemSeed[collectionLocal][0]["_id"] = paramRequest_Frame.ObjectId;
                                paramResponse_Frame.CellPath = collectionLocal;
                                function_ActionAsync(paramResponse_Base.connectionId, paramResponse_Base);
                            }
                        }
                    );
                }
                break;
            case 'CellPick':
                var queryTerm = {};
                var collectionLocal = null;
                if (paramRequest_Frame.CellPath != null) {
                    if (paramRequest_Frame.RowPath != null && paramRequest_Frame.RowPath != '__null__') {
                        collectionLocal = paramRequest_Frame.RowPath;
                        queryTerm['Name'] = {$eq: paramRequest_Frame.CellPath};
                    } else {
                        collectionLocal = paramRequest_Frame.CellPath;
                        this.WBContext.Path = {};
                        this.WBContext.Path[collectionLocal] = {};
                    }
                }
                if (collectionLocal != null) {
                    wbAppController.dbHandleMongo.collection(collectionLocal).find(queryTerm).toArray(
                        function(err, result) {
                            if (err) throw err;
                            if (result != null) {
                                if (result.length >= 0) {
                                    paramResponse_Frame.Content = {Seed:{ItemSeed: {}}};
                                    if (paramRequest_Frame.RowPath != null && paramRequest_Frame.RowPath != '__null__') {
                                        paramResponse_Frame.RowPath = paramRequest_Frame.RowPath;
                                    }
                                    if (paramRequest_Frame.CellPath != null) {
                                        paramResponse_Frame.CellPath = paramRequest_Frame.CellPath;
                                    }
                                    if (queryTerm['Name'] == null) {
                                        paramResponse_Frame.Content.Seed.ItemSeed[paramRequest_Frame.CellPath] = result;
                                    } else {
                                        paramResponse_Frame.Content.Seed.ItemSeed[paramRequest_Frame.RowPath] = result;
                                    }
                                    function_ActionAsync(paramResponse_Base.connectionId, paramResponse_Base);
                                }
                            }
                        }
                    );
                }
                break;
            case 'Drilldown':
                var queryTerm = {};
                if (paramRequest_Frame.RowPath != null && paramRequest_Frame.RowPath != '__null__') {
                    queryTerm['Name'] = {$eq: paramRequest_Frame.RowPath};
                }
                var collectionLocal = Object.keys(this.WBContext.Path)[0];
                wbAppController.dbHandleMongo.collection(collectionLocal).find(queryTerm).toArray(
                    function(err, result) {
                        if (err) throw err;
                        if (result != null) {
                            if (result.length > 0) {
                                paramResponse_Frame.Content = {Seed:{ItemSeed: {}}};
                                if (paramRequest_Frame.RowPath != null && paramRequest_Frame.RowPath != '__null__') {
                                    paramResponse_Frame.RowPath = paramRequest_Frame.RowPath;
                                }
                                if (paramRequest_Frame.CellPath != null) {
                                    paramResponse_Frame.CellPath = paramRequest_Frame.CellPath;
                                }
                                paramResponse_Frame.Content.Seed.ItemSeed[collectionLocal] = {};
                                if (queryTerm['Name'] == null) {
                                    paramResponse_Frame.Content.Seed.ItemSeed = result[0];
                                } else {
                                    paramResponse_Frame.Content.Seed.ItemSeed = result[0];
                                }
                                function_ActionAsync(paramResponse_Base.connectionId, paramResponse_Base);
                            }
                        }
                    }
                );
                break;
            case 'Add':
                if (paramRequest_Frame.CellPath != null) {
                    paramResponse_Frame.CellPath = paramRequest_Frame.CellPath;
                }
                function_ActionAsync(paramResponse_Base.connectionId, paramResponse_Base);
                break;
            case 'Present':
                function_ActionAsync(paramResponse_Base.connectionId, paramResponse_Base);
                break;
            case 'Cancel':
                function_ActionAsync(paramResponse_Base.connectionId, paramResponse_Base);
                break;
        }
    }
}

/*
Class:            WBContext
Description:      Specifies the context that determines what data must be projected
*/

function WBContext() {
    
}

/*
Class:            WBProjection
Description:      Data projected on a collection
*/

function WBProjection() {
    
}

/*
Class:            WBRow
Description:      An item in a collection
*/

function WBRow() {
    
}

/*
Class:            WBCell
Description:      An element in an item
*/

function WBCell() {
    
}
