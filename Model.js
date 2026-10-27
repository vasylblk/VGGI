'use strict';

function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.indexCount = 0;

    this.calcPoint = function(u, v, C = 1.0) {
        const sqrtCp1 = Math.sqrt(C + 1.0);
        const sqrtC = Math.sqrt(C);

        // (4) phi
        const phi = -u / sqrtCp1 + Math.atan(Math.tan(u) * sqrtCp1);

        // (5) a
        const sinV = Math.sin(v);
        const cosU = Math.cos(u);
        const a = 2.0 / (C + 1.0 - C * sinV * sinV * cosU * cosU);

        // (6) r
        const sinU = Math.sin(u);
        const r = (a * Math.sqrt((C + 1.0) * (1.0 + C * sinU * sinU)) * sinV) / sqrtC;

        // (1), (2) x, y
        const x = r * Math.cos(phi);
        const y = r * Math.sin(phi);

        // (3) z
        const tanHalfV = Math.tan(v / 2.0);
        const lnTan = Math.log(tanHalfV);
        const cosV = Math.cos(v);
        const z = (lnTan + a * (C + 1.0) * cosV) / sqrtC;

        return [x, y, z];
    };

    // Обчислення кута
    this.calcAngle = function(v1, v2, v3) {
        const d1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
        const d2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

        const len1 = Math.hypot(d1[0], d1[1], d1[2]);
        const len2 = Math.hypot(d2[0], d2[1], d2[2]);

        if (len1 < 1e-6 || len2 < 1e-6) return 0.0;

        const dot = (d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2]) / (len1 * len2);
        return Math.acos(Math.max(-1.0, Math.min(1.0, dot)));
    };

    // Генерація сітки трикутників та розрахунок нормалей
    this.CreateSurfaceData = function(uSteps = 50, vSteps = 50) {
        const vertices = [];
        const indices = [];

        const uMin = -1.5;
        const uMax = 1.5;

        const eps = 0.05;
        const vMin = eps;
        const vMax = Math.PI - eps;

        const du = (uMax - uMin) / uSteps;
        const dv = (vMax - vMin) / vSteps;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        //Побудова регулярної сітки вершин
        for (let j = 0; j <= vSteps; j++) {
            const v = vMin + j * dv;
            for (let i = 0; i <= uSteps; i++) {
                const u = uMin + i * du;
                const p = this.calcPoint(u, v);

                if (p[0] < minX) minX = p[0];
                if (p[0] > maxX) maxX = p[0];
                if (p[1] < minY) minY = p[1];
                if (p[1] > maxY) maxY = p[1];
                if (p[2] < minZ) minZ = p[2];
                if (p[2] > maxZ) maxZ = p[2];

                vertices.push(p);
            }
        }

        const cx = (minX + maxX) / 2.0;
        const cy = (minY + maxY) / 2.0;
        const cz = (minZ + maxZ) / 2.0;

        for (let i = 0; i < vertices.length; i++) {
            vertices[i][0] -= cx;
            vertices[i][1] -= cy;
            vertices[i][2] -= cz;
        }

        //Індексація заповнених трикутників
        const stride = uSteps + 1;
        for (let j = 0; j < vSteps; j++) {
            for (let i = 0; i < uSteps; i++) {
                const idx0 = j * stride + i;
                const idx1 = idx0 + 1;
                const idx2 = (j + 1) * stride + i;
                const idx3 = idx2 + 1;

                indices.push(idx0, idx2, idx1);
                indices.push(idx1, idx2, idx3);
            }
        }

        //Facet Angle Weighted Average Normals
        const numVerts = vertices.length;
        const weightedNormals = Array.from({ length: numVerts }, () => [0, 0, 0]);

        for (let k = 0; k < indices.length; k += 3) {
            const i0 = indices[k];
            const i1 = indices[k + 1];
            const i2 = indices[k + 2];

            const p0 = vertices[i0];
            const p1 = vertices[i1];
            const p2 = vertices[i2];

            // Вектори сторін грані
            const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];

            // Facet Normal
            const fn = [
                e1[1] * e2[2] - e1[2] * e2[1],
                e1[2] * e2[0] - e1[0] * e2[2],
                e1[0] * e2[1] - e1[1] * e2[0]
            ];
            const fnLen = Math.hypot(fn[0], fn[1], fn[2]);
            if (fnLen > 1e-6) {
                fn[0] /= fnLen;
                fn[1] /= fnLen;
                fn[2] /= fnLen;
            }

            // Внутрішні кути трикутника
            const a0 = this.calcAngle(p0, p1, p2);
            const a1 = this.calcAngle(p1, p2, p0);
            const a2 = this.calcAngle(p2, p0, p1);

            // Накопичення зважених нормалей
            weightedNormals[i0][0] += fn[0] * a0;
            weightedNormals[i0][1] += fn[1] * a0;
            weightedNormals[i0][2] += fn[2] * a0;

            weightedNormals[i1][0] += fn[0] * a1;
            weightedNormals[i1][1] += fn[1] * a1;
            weightedNormals[i1][2] += fn[2] * a1;

            weightedNormals[i2][0] += fn[0] * a2;
            weightedNormals[i2][1] += fn[1] * a2;
            weightedNormals[i2][2] += fn[2] * a2;
        }

        // Нормалізація результуючих векторів
        const normalList = [];
        const flatVertList = [];
        for (let i = 0; i < numVerts; i++) {
            flatVertList.push(...vertices[i]);

            const wn = weightedNormals[i];
            const len = Math.hypot(wn[0], wn[1], wn[2]);
            if (len > 1e-6) {
                normalList.push(wn[0] / len, wn[1] / len, wn[2] / len);
            } else {
                normalList.push(0, 0, 1);
            }
        }

        return {
            vertices: flatVertList,
            normals: normalList,
            indices: indices
        };
    };

    this.BufferData = function(data) {
        // VBO вершин
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertices), gl.STATIC_DRAW);

        // VBO нормалей
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);

        // Element Buffer Object
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);

        this.indexCount = data.indices.length;
    };

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    };
}