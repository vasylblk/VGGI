'use strict';

let uSegments = 60;
let vSegments = 60;

const repeatU = 4, repeatV = 2;

//функція поверхні Зіверта
function sievertPoint(u, v, C = 1.0) {
    const sqrtCp1 = Math.sqrt(C + 1.0);
    const sqrtC = Math.sqrt(C);

    const phi = -u / sqrtCp1 + Math.atan(Math.tan(u) * sqrtCp1);
    const sinV = Math.sin(v);
    const cosU = Math.cos(u);
    const a = 2.0 / (C + 1.0 - C * sinV * sinV * cosU * cosU);

    const sinU = Math.sin(u);
    const r = (a * Math.sqrt((C + 1.0) * (1.0 + C * sinU * sinU)) * sinV) / sqrtC;

    const x = r * Math.cos(phi);
    const y = r * Math.sin(phi);

    const tanHalfV = Math.tan(v / 2.0);
    const lnTan = Math.log(tanHalfV);
    const cosV = Math.cos(v);
    const z = (lnTan + a * (C + 1.0) * cosV) / sqrtC;

    return [x, y, z];
}

function sievertTangent(u, v, C = 1.0) {
    const du = 0.0005;
    const p1 = sievertPoint(u - du, v, C);
    const p2 = sievertPoint(u + du, v, C);

    const tx = (p2[0] - p1[0]) / (2 * du);
    const ty = (p2[1] - p1[1]) / (2 * du);
    const tz = (p2[2] - p1[2]) / (2 * du);

    const len = Math.hypot(tx, ty, tz) || 1.0;
    return [tx / len, ty / len, tz / len];
}

function CreateSurfaceData() {
    const rawVertices = [];
    const tangents = [];
    const texCoords = [];
    const indices = [];

    const uMin = -1.52;
    const uMax = 1.52;
    const eps = 0.06;
    const vMin = eps;
    const vMax = Math.PI - eps;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    //Обчислення точок
    for (let i = 0; i <= uSegments; i++) {
        const u = uMin + (uMax - uMin) * (i / uSegments);
        for (let j = 0; j <= vSegments; j++) {
            const v = vMin + (vMax - vMin) * (j / vSegments);
            const p = sievertPoint(u, v);

            if (p[0] < minX) minX = p[0];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[1] > maxY) maxY = p[1];
            if (p[2] < minZ) minZ = p[2];
            if (p[2] > maxZ) maxZ = p[2];

            rawVertices.push(p);
            tangents.push(...sievertTangent(u, v));
            texCoords.push(repeatU * i / uSegments, repeatV * j / vSegments);
        }
    }

    // Центрування поверхні Зіверта
    const cx = (minX + maxX) / 2.0;
    const cy = (minY + maxY) / 2.0;
    const cz = (minZ + maxZ) / 2.0;

    const vertices = [];
    for (let i = 0; i < rawVertices.length; i++) {
        vertices.push(
            rawVertices[i][0] - cx,
            rawVertices[i][1] - cy,
            rawVertices[i][2] - cz
        );
    }

    //Індекси для трикутників
    for (let i = 0; i < uSegments; i++) {
        for (let j = 0; j < vSegments; j++) {
            const i0 = i * (vSegments + 1) + j;
            const i1 = i0 + 1;
            const i2 = i0 + vSegments + 1;
            const i3 = i2 + 1;

            indices.push(i0, i2, i1);
            indices.push(i1, i2, i3);
        }
    }

    return {
        vertices: vertices,
        indices: indices,
        tangents: tangents,
        texCoords: texCoords,
        normals: CalculateNormals(vertices, indices)
    };
}

function CalculateNormals(vertices, indices) {
    const normals = new Array(vertices.length).fill(0);

    for (let t = 0; t < indices.length; t += 3) {
        const p0 = indices[t] * 3;
        const p1 = indices[t + 1] * 3;
        const p2 = indices[t + 2] * 3;

        const ax = vertices[p1] - vertices[p0];
        const ay = vertices[p1 + 1] - vertices[p0 + 1];
        const az = vertices[p1 + 2] - vertices[p0 + 2];

        const bx = vertices[p2] - vertices[p0];
        const by = vertices[p2 + 1] - vertices[p0 + 1];
        const bz = vertices[p2 + 2] - vertices[p0 + 2];

        const cx = ay * bz - az * by;
        const cy = az * bx - ax * bz;
        const cz = ax * by - ay * bx;

        const len = Math.hypot(cx, cy, cz);
        if (len === 0) continue;

        const area = len / 2.0;
        const nx = (cx / len) * area;
        const ny = (cy / len) * area;
        const nz = (cz / len) * area;

        for (const p of [p0, p1, p2]) {
            normals[p]     += nx;
            normals[p + 1] += ny;
            normals[p + 2] += nz;
        }
    }

    for (let p = 0; p < normals.length; p += 3) {
        const len = Math.hypot(normals[p], normals[p + 1], normals[p + 2]);
        if (len === 0) {
            normals[p + 2] = 1;
            continue;
        }
        normals[p]     /= len;
        normals[p + 1] /= len;
        normals[p + 2] /= len;
    }

    return normals;
}

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer();
    this.iTexCoordBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;

    this.idTextureDiffuse = -1;
    this.idTextureSpecular = -1;
    this.idTextureNormal = -1;

    this.BufferData = function(data) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.tangents), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.texCoords), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);

        this.count = data.indices.length;
    };

    this.Draw = function() {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureDiffuse);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureSpecular);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoord);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    };
}