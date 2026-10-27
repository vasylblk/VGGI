'use strict';

let gl;
let surface;
let shProgram;
let spaceball;
let lightAngle = 0;

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex              = -1;
    this.iAttribNormal              = -1;
    this.iModelViewProjectionMatrix = -1;
    this.iModelViewMatrix           = -1;
    this.iNormalMatrix              = -1;
    this.iLightPosition             = -1;
    this.iColor                     = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    };
}

function updateModelGranularity() {
    const uSteps = parseInt(document.getElementById('uSteps').value, 10);
    const vSteps = parseInt(document.getElementById('vSteps').value, 10);
    document.getElementById('uVal').textContent = uSteps;
    document.getElementById('vVal').textContent = vSteps;

    const data = surface.CreateSurfaceData(uSteps, vSteps);
    surface.BufferData(data);
}

function draw() {
    gl.clearColor(0.08, 0.08, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let projection = m4.perspective(Math.PI / 4, 1, 0.1, 100);
    let view = spaceball.getViewMatrix();   

    let scaleMat = m4.scaling(0.5, 0.5, 0.5);
    let modelView = m4.multiply(view, scaleMat);

    let modelViewProjection = m4.multiply(projection, modelView);

    // Normal Matrix
    let invMat = m4.inverse(modelView);
    let normalMatrix = [
        invMat[0], invMat[4], invMat[8],
        invMat[1], invMat[5], invMat[9],
        invMat[2], invMat[6], invMat[10]
    ];

    const radius = 6.0;
    const worldLightPos = [
        radius * Math.cos(lightAngle),
        radius * Math.sin(lightAngle),
        2.0
    ];

    const eyeLightPos = m4.transformPoint(view, worldLightPos);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelView);
    gl.uniformMatrix3fv(shProgram.iNormalMatrix, false, new Float32Array(normalMatrix));
    gl.uniform3fv(shProgram.iLightPosition, eyeLightPos);
    
    gl.uniform4fv(shProgram.iColor, [0.15, 0.65, 0.85, 1.0]);

    
    surface.Draw();
}

function animate() {
    lightAngle += 0.02;
    draw();
    requestAnimationFrame(animate);
}

function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('PhongLighting', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal              = gl.getAttribLocation(prog, "normal");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iNormalMatrix              = gl.getUniformLocation(prog, "NormalMatrix");
    shProgram.iLightPosition             = gl.getUniformLocation(prog, "lightPosition");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    surface = new Model('SievertSurface');
    updateModelGranularity();

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Vertex shader error: " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Fragment shader error: " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Program link error: " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function init() {
    let canvas = document.getElementById("webglcanvas");
    try {
        gl = canvas.getContext("webgl");
        if (!gl) throw "WebGL not supported";
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML = "<p>WebGL initialization failed: " + e + "</p>";
        return;
    }

    initGL();

    spaceball = new TrackballRotator(canvas, draw, 9);

    // Повзунки
    document.getElementById('uSteps').addEventListener('input', updateModelGranularity);
    document.getElementById('vSteps').addEventListener('input', updateModelGranularity);

    animate();
}