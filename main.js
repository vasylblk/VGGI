'use strict';

let gl;
let surface;
let shProgram;
let spaceball;
let lightAngle = 0;
let lightMarker;
let usedMaps = { diffuse: 1, specular: 1, normal: 1 };

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex              = -1;
    this.iAttribNormal              = -1;
    this.iAttribTangent             = -1;
    this.iAttribTexCoord            = -1;
    this.iDiffuseMap                = -1;
    this.iSpecularMap               = -1;
    this.iNormalMap                 = -1;
    this.iUseDiffuseMap             = -1;
    this.iUseSpecularMap            = -1;
    this.iUseNormalMap              = -1;
    this.iModelViewProjectionMatrix = -1;
    this.iModelViewMatrix           = -1;
    this.iNormalMatrix              = -1;
    this.iLightPosition             = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    };
}

function draw() { 
    shProgram.Use();

    gl.clearColor(0.08, 0.08, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    let projection = m4.perspective(Math.PI / 4, 1, 0.1, 100); 
    let modelView = spaceball.getViewMatrix();

    // Масштабування для вікна перегляду
    let scaleMat = m4.scaling(1.1, 1.1, 1.1);
    let matAccum1 = m4.multiply(modelView, scaleMat);
        
    let modelViewProjection = m4.multiply(projection, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
    gl.uniformMatrix3fv(shProgram.iNormalMatrix, false, NormalMatrix(matAccum1));

    gl.uniform3fv(shProgram.iLightPosition, m4.transformPoint(modelView, LightPosition()));

    gl.uniform1i(shProgram.iUseDiffuseMap, usedMaps.diffuse);
    gl.uniform1i(shProgram.iUseSpecularMap, usedMaps.specular);
    gl.uniform1i(shProgram.iUseNormalMap, usedMaps.normal);

    surface.Draw();

    // маркер світла
    let markerMVP = m4.multiply(projection, modelView);
    DrawLightMarker(markerMVP);
}

function DrawLightMarker(modelViewProjection) {
    gl.useProgram(lightMarker.prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, lightMarker.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(LightPosition()), gl.STREAM_DRAW);
    gl.vertexAttribPointer(lightMarker.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(lightMarker.iAttribVertex);

    gl.uniformMatrix4fv(lightMarker.iModelViewProjectionMatrix, false, modelViewProjection);

    gl.drawArrays(gl.POINTS, 0, 1);
}

function LightPosition() {
    const radius = 6.0;
    return [radius * Math.cos(lightAngle), radius * Math.sin(lightAngle), 2.5];
}

function NormalMatrix(modelView) {
    const m = m4.transpose(m4.inverse(modelView));
    return [m[0], m[1], m[2],
            m[4], m[5], m[6],
            m[8], m[9], m[10]];
}

function animate() {
    lightAngle += 0.015;
    draw();
    window.requestAnimationFrame(animate);
}

function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal              = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribTangent             = gl.getAttribLocation(prog, "tangent");
    shProgram.iAttribTexCoord            = gl.getAttribLocation(prog, "texCoord");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iNormalMatrix              = gl.getUniformLocation(prog, "NormalMatrix");
    shProgram.iLightPosition             = gl.getUniformLocation(prog, "lightPosition");
    shProgram.iDiffuseMap                = gl.getUniformLocation(prog, "diffuseMap");
    shProgram.iSpecularMap               = gl.getUniformLocation(prog, "specularMap");
    shProgram.iNormalMap                 = gl.getUniformLocation(prog, "normalMap");
    shProgram.iUseDiffuseMap             = gl.getUniformLocation(prog, "useDiffuseMap");
    shProgram.iUseSpecularMap            = gl.getUniformLocation(prog, "useSpecularMap");
    shProgram.iUseNormalMap              = gl.getUniformLocation(prog, "useNormalMap");

    gl.uniform1i(shProgram.iDiffuseMap, 0);
    gl.uniform1i(shProgram.iSpecularMap, 1);
    gl.uniform1i(shProgram.iNormalMap, 2);

    const markerProg = createProgram(gl, markerVertexShaderSource, markerFragmentShaderSource);
    lightMarker = {
        prog: markerProg,
        buffer: gl.createBuffer(),
        iAttribVertex: gl.getAttribLocation(markerProg, "vertex"),
        iModelViewProjectionMatrix: gl.getUniformLocation(markerProg, "ModelViewProjectionMatrix")
    };

    surface = new Model('SievertSurface');
    surface.BufferData(CreateSurfaceData());

    surface.idTextureDiffuse  = LoadTexture("https://threejs.org/examples/textures/brick_diffuse.jpg");
    surface.idTextureSpecular = LoadTexture("https://threejs.org/examples/textures/brick_roughness.jpg");
    surface.idTextureNormal   = LoadTexture("https://threejs.org/examples/textures/brick_bump.jpg");

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Vertex shader: " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Fragment shader: " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error: " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function initControls() {
    const uInput = document.getElementById("uSegments");
    const vInput = document.getElementById("vSegments");

    uInput.value = uSegments;
    vInput.value = vSegments;
    document.getElementById("uSegments-value").textContent = uSegments;
    document.getElementById("vSegments-value").textContent = vSegments;

    uInput.addEventListener("input", () => {
        uSegments = parseInt(uInput.value);
        document.getElementById("uSegments-value").textContent = uSegments;
        surface.BufferData(CreateSurfaceData());
    });

    vInput.addEventListener("input", () => {
        vSegments = parseInt(vInput.value);
        document.getElementById("vSegments-value").textContent = vSegments;
        surface.BufferData(CreateSurfaceData());
    });

    for (const map of ["diffuse", "specular", "normal"]) {
        const box = document.getElementById(map + "Map");
        box.checked = !!usedMaps[map];
        box.addEventListener("change", () => { 
            usedMaps[map] = box.checked ? 1 : 0; 
        });
    }
}

function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>not initialize WebGL: " + e + "</p>";
        return;
    }

    initControls();

    spaceball = new TrackballRotator(canvas, draw, 8);

    animate();
}