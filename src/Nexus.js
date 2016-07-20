/*
Copyright 2015, 2016 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://raw.githubusercontent.com/GPII/nexus/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    gpii = fluid.registerNamespace("gpii");

fluid.defaults("gpii.nexus", {
    gradeNames: ["kettle.app"],
    requestHandlers: {
        readDefaults: {
            route: "/defaults/:gradeName",
            method: "get",
            type: "gpii.nexus.readDefaults.handler"
        },
        writeDefaults: {
            route: "/defaults/:gradeName",
            method: "put",
            type: "gpii.nexus.writeDefaults.handler"
        },
        constructComponent: {
            route: "/components/:path",
            method: "post",
            type: "gpii.nexus.constructComponent.handler"
        },
        destroyComponent: {
            route: "/components/:path",
            method: "delete",
            type: "gpii.nexus.destroyComponent.handler"
        },
        bindModel: {
            route: "/bindModel/:componentPath/:modelPath",
            type: "gpii.nexus.bindModel.handler"
        }
    }
});

fluid.defaults("gpii.nexus.readDefaults.handler", {
    gradeNames: ["kettle.request.http"],
    invokers: {
        handleRequest: {
            funcName: "gpii.nexus.readDefaults.handleRequest",
            args: ["{request}.req.params.gradeName", "{request}"]
        }
    }
});

gpii.nexus.readDefaults.handleRequest = function (gradeName, request) {
    var defaults = fluid.defaults(gradeName);
    if (defaults) {
        request.events.onSuccess.fire(defaults);
    } else {
        request.events.onError.fire({
            message: "Grade not found",
            statusCode: 404
        });
    }
};

fluid.defaults("gpii.nexus.writeDefaults.handler", {
    gradeNames: ["kettle.request.http"],
    invokers: {
        handleRequest: {
            funcName: "gpii.nexus.writeDefaults.handleRequest",
            args: ["{request}.req.params.gradeName", "{request}"]
        }
    }
});

gpii.nexus.writeDefaults.handleRequest = function (gradeName, request) {
    fluid.defaults(gradeName, request.req.body);
    request.events.onSuccess.fire();
};

fluid.defaults("gpii.nexus.constructComponent.handler", {
    gradeNames: ["kettle.request.http"],
    invokers: {
        handleRequest: {
            funcName: "gpii.nexus.constructComponent.handleRequest",
            args: ["{request}.req.params.path", "{request}"]
        }
    }
});

// TODO: Complain when component cannot be constructed due to parent not existing
gpii.nexus.constructComponent.handleRequest = function (path, request) {
    var segs = fluid.pathUtil.parseEL(path);
    fluid.construct(segs, request.req.body);
    request.events.onSuccess.fire();
};

fluid.defaults("gpii.nexus.destroyComponent.handler", {
    gradeNames: ["kettle.request.http"],
    invokers: {
        handleRequest: {
            funcName: "gpii.nexus.destroyComponent.handleRequest",
            args: ["{request}.req.params.path", "{request}"]
        }
    }
});

// TODO: Complain when component is not found
gpii.nexus.destroyComponent.handleRequest = function (path, request) {
    var segs = fluid.pathUtil.parseEL(path);
    fluid.destroy(segs);
    request.events.onSuccess.fire();
};

fluid.defaults("gpii.nexus.bindModel.handler", {
    gradeNames: ["kettle.request.ws"],
    members: {
        // We store the targetComponent inside a container so that the
        // component is isolated from IoC references. This will not be
        // necessary in the future after upcoming framework changes
        // are completed.
        // See https://issues.fluidproject.org/browse/FLUID-4925
        componentHolder: {
            targetComponent: null // Will be set at onBindWs
        },
        modelPathSegs: null, // Will be set at onBindWs
        targetModelChangeListenerId: null // Will be set at onBindWs
    },
    invokers: {
        targetModelChangeListener: {
            funcName: "gpii.nexus.bindModel.targetModelChangeListener",
            args: [
                "{that}",
                "{arguments}.0" // value
            ]
        }
    },
    listeners: {
        onBindWs: {
            funcName: "gpii.nexus.bindModel.bindWs",
            args: [
                "{that}",
                "{request}.req.params.componentPath",
                "{request}.req.params.modelPath",
                "{that}.targetModelChangeListener"
            ]
        },
        onReceiveMessage: {
            funcName: "gpii.nexus.bindModel.receiveMessage",
            args: [
                "{that}.componentHolder.targetComponent",
                "{that}.modelPathSegs",
                "{arguments}.1" // message
            ]
        },
        onDestroy: {
            "this": "{that}.componentHolder.targetComponent.applier.modelChanged",
            method: "removeListener",
            args: ["{that}.targetModelChangeListenerId"]
        }
    }
});

// TODO: GPII-1679 Support both string and array paths
// TODO: GPII-1680 Move gpii.nexus.componentForPath to infusion FluidIoC.js "BEGIN NEXUS METHODS"
gpii.nexus.componentForPath = function (path) {
    return fluid.globalInstantiator.pathToComponent[path];
};

gpii.nexus.bindModel.bindWs = function (handler, componentPath, modelPath, modelChangeListener) {
    handler.componentHolder.targetComponent = gpii.nexus.componentForPath(componentPath);
    // TODO: Note that applier.modelchanged.addListener is different from https://wiki.gpii.net/w/Nexus_API
    //       Which says applier.addModelListener
    handler.modelPathSegs = fluid.pathUtil.parseEL(modelPath);
    handler.targetModelChangeListenerId = fluid.allocateGuid();
    handler.componentHolder.targetComponent.applier.modelChanged.addListener(
        {
            segs: handler.modelPathSegs,
            listenerId: handler.targetModelChangeListenerId
        },
        modelChangeListener
    ); // TODO: namespace?

    // On connect, send a message with the state of the component's model at modelPath
    handler.sendMessage(fluid.get(handler.componentHolder.targetComponent.model, handler.modelPathSegs));
};

gpii.nexus.bindModel.targetModelChangeListener = function (handler, value) {
    handler.sendMessage(value);
};

gpii.nexus.bindModel.receiveMessage = function (component, baseModelPathSegs, message) {
    var messagePathSegs = fluid.pathUtil.parseEL(message.path);
    var changePathSegs = baseModelPathSegs.concat(messagePathSegs);
    component.applier.fireChangeRequest(
        {
            segs: changePathSegs,
            value: message.value,
            type: message.type
        }
    );
};
