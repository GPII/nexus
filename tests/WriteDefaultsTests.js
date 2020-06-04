/*
Copyright 2015, 2016 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://raw.githubusercontent.com/fluid-project/infusion-nexus/master/LICENSE.txt
*/

/* eslint-env node */

"use strict";

var fluid = require("infusion"),
    kettle = require("kettle");

require("../index.js");
require("../src/test/nexusTestUtils.js");

kettle.loadTestingSupport();

fluid.registerNamespace("fluid.tests.nexus.writeDefaults");

fluid.tests.nexus.writeDefaults.newGradeOptions = {
    gradeNames: ["fluid.component"],
    model: {
        name1: "hello world"
    }
};

fluid.tests.nexus.writeDefaults.updatedGradeOptions = {
    gradeNames: ["fluid.component"],
    model: {
        updatedGrade: true
    }
};

fluid.tests.nexus.writeDefaults.badlyFormedInvokerGradeOptions = {
    gradeNames: ["fluid.component"],
    invokers: {
        invoker1: "bad("
    }
};

fluid.defaults("fluid.tests.nexus.writeDefaults.badlyFormedJson", {
    gradeNames: "fluid.resourceLoader",
    resources: {
        corruptJSON: {
            path: "%infusion-nexus/tests/data/corruptJSONFile.jsonx",
            dataType: "text"
        }
    }
});

fluid.tests.nexus.writeDefaults.sendBadlyFormedInvokerGradeOptions = function (request) {
    request.send(fluid.tests.nexus.writeDefaults.badlyFormedInvokerGradeOptions);
};

fluid.tests.nexus.writeDefaults.rememberReadDefaultsResponse = function (body, component) {
    component.readDefaultsResponseBody = body;
    component.readDefaultsResponseGradeSpec = JSON.parse(body);
};

fluid.tests.nexus.writeDefaults.testDefs = [
    {
        name: "Write Defaults with good grade options and verify update to the grade",
        gradeNames: "fluid.test.nexus.testCaseHolder",
        expect: 11,
        config: {
            configName: "fluid.tests.nexus.config",
            configPath: "%infusion-nexus/tests/configs"
        },
        testGradeName: "fluid.tests.nexus.writeDefaults.newGradeRemote",
        sequence: [
            {
                func: "{readDefaultsRequest1}.send"
            },
            {
                event: "{readDefaultsRequest1}.events.onComplete",
                listener: "kettle.test.assertErrorResponse",
                args: [{
                    message: "Read Defaults returns 404 as we haven't created the new grade yet",
                    errorTexts: "Grade not found",
                    string: "{arguments}.0",
                    request: "{readDefaultsRequest1}",
                    statusCode: 404
                }]
            },
            {
                func: "{writeDefaultsRequest1}.send",
                args: [fluid.tests.nexus.writeDefaults.newGradeOptions]
            },
            {
                event: "{writeDefaultsRequest1}.events.onComplete",
                listener: "fluid.test.nexus.assertStatusCode",
                args: ["{writeDefaultsRequest1}", 200]
            },
            {
                func: "{readDefaultsRequest2}.send"
            },
            {
                event: "{readDefaultsRequest2}.events.onComplete",
                listener: "fluid.test.nexus.verifyReadDefaultsResponse",
                args: [
                    "{arguments}.0",
                    "{readDefaultsRequest2}",
                    {
                        gradeNames: ["fluid.component", "fluid.tests.nexus.writeDefaults.newGradeRemote"],
                        model: {
                            name1: "hello world"
                        }
                    }
                ]
            },
            {
                func: "{writeDefaultsRequest2}.send",
                args: [fluid.tests.nexus.writeDefaults.updatedGradeOptions]
            },
            {
                event: "{writeDefaultsRequest2}.events.onComplete",
                listener: "fluid.test.nexus.assertStatusCode",
                args: ["{writeDefaultsRequest2}", 200]
            },
            {
                func: "{readDefaultsRequest3}.send"
            },
            {
                event: "{readDefaultsRequest3}.events.onComplete",
                listener: "fluid.test.nexus.verifyReadDefaultsResponse",
                args: [
                    "{arguments}.0",
                    "{readDefaultsRequest3}",
                    {
                        gradeNames: ["fluid.component", "fluid.tests.nexus.writeDefaults.newGradeRemote"],
                        model: {
                            updatedGrade: true
                        }
                    }
                ]
            }
        ]
    },
    {
        name: "Write Defaults with badly formed JSON",
        gradeNames: ["fluid.test.nexus.testCaseHolder", "fluid.tests.nexus.writeDefaults.badlyFormedJson"],
        expect: 3,
        config: {
            configName: "fluid.tests.nexus.config",
            configPath: "%infusion-nexus/tests/configs"
        },
        testGradeName: "fluid.tests.nexus.writeDefaults.badlyFormedJsonRemote",
        sequence: [
            {
                event: "{badlyFormedJson}.events.onResourcesLoaded",
                listener: "fluid.identity"
            },
            {
                func: "{writeDefaultsRequest1}.send",
                args: [
                    "{badlyFormedJson}.resources.corruptJSON.resourceText",
                    {
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                ]
            },
            {
                event: "{writeDefaultsRequest1}.events.onComplete",
                listener: "kettle.test.assertErrorResponse",
                args: [{
                    message: "Write Defaults returns 400 for badly formed JSON",
                    // In Node 4, parsing JSON that is not properly closed
                    // results in the error message "Unexpected end of input".
                    // In Node 6, the message was changed to "Unexpected end
                    // of JSON input".
                    // Here we test for "Unexpected end of" so that the test
                    // works as expected in both Node 4 and Node 6.
                    // https://issues.fluid.net/browse/GPII-2080
                    errorTexts: "Unexpected end of",
                    string: "{arguments}.0",
                    request: "{writeDefaultsRequest1}",
                    statusCode: 400
                }]
            }
        ]
    },
    {
        name: "Write Defaults with badly formed grade",
        gradeNames: "fluid.test.nexus.testCaseHolder",
        expect: 3,
        config: {
            configName: "fluid.tests.nexus.config",
            configPath: "%infusion-nexus/tests/configs"
        },
        testGradeName: "fluid.tests.nexus.writeDefaults.badlyFormedInvokerRemote",
        sequence: [
            {
                funcName: "kettle.test.pushInstrumentedErrors",
                args: ["fluid.identity"]
            },
            {
                funcName: "fluid.tests.nexus.writeDefaults.sendBadlyFormedInvokerGradeOptions",
                args: ["{writeDefaultsRequest1}"]
            },
            {
                event: "{writeDefaultsRequest1}.events.onComplete",
                listener: "kettle.test.assertErrorResponse",
                args: [{
                    message: "Write Defaults returns 500 for badly formed grade",
                    errorTexts: "Badly-formed compact invoker record without matching parentheses: bad(",
                    string: "{arguments}.0",
                    request: "{writeDefaultsRequest1}",
                    statusCode: 500
                }]
            },
            {
                funcName: "kettle.test.popInstrumentedErrors"
            }
        ]
    },
    {
        name: "Send a Read Defaults response back to Write Defaults and verify that the grade is stable",
        gradeNames: "fluid.test.nexus.testCaseHolder",
        expect: 8,
        config: {
            configName: "fluid.tests.nexus.config",
            configPath: "%infusion-nexus/tests/configs"
        },
        testGradeName: "fluid.tests.nexus.writeDefaults.newGradeRemote",
        sequence: [
            {
                func: "{writeDefaultsRequest1}.send",
                args: [fluid.tests.nexus.writeDefaults.newGradeOptions]
            },
            {
                event: "{writeDefaultsRequest1}.events.onComplete",
                listener: "fluid.test.nexus.assertStatusCode",
                args: ["{writeDefaultsRequest1}", 200]
            },
            {
                func: "{readDefaultsRequest1}.send"
            },
            {
                event: "{readDefaultsRequest1}.events.onComplete",
                listener: "fluid.tests.nexus.writeDefaults.rememberReadDefaultsResponse",
                args: ["{arguments}.0", "{tests}"]
            },
            {
                funcName: "fluid.test.nexus.verifyReadDefaultsResponse",
                args: [
                    "{tests}.readDefaultsResponseBody",
                    "{readDefaultsRequest1}",
                    {
                        gradeNames: ["fluid.component", "fluid.tests.nexus.writeDefaults.newGradeRemote"],
                        model: {
                            name1: "hello world"
                        }
                    }
                ]
            },
            {
                func: "{writeDefaultsRequest2}.send",
                args: ["{tests}.readDefaultsResponseGradeSpec"]
            },
            {
                event: "{writeDefaultsRequest2}.events.onComplete",
                listener: "fluid.test.nexus.assertStatusCode",
                args: ["{writeDefaultsRequest2}", 200]
            },
            {
                func: "{readDefaultsRequest2}.send"
            },
            {
                event: "{readDefaultsRequest2}.events.onComplete",
                listener: "fluid.test.nexus.verifyReadDefaultsResponse",
                args: [
                    "{arguments}.0",
                    "{readDefaultsRequest2}",
                    "{tests}.readDefaultsResponseGradeSpec"
                ]
            }
        ]
    }
];

kettle.test.bootstrapServer(fluid.tests.nexus.writeDefaults.testDefs);
