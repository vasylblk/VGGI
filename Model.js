'use strict';

function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.count = 0;

    // Обчислення координат точки за формулами (1)-(6)
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

    // Генерація каркаса: лінії вздовж U та вздовж V
    this.CreateSievertData = function() {
        const vertexList = [];

        const uSteps = 50;
        const vSteps = 50;

        // Межі параметрів: |u| < pi/2 та 0 < v < pi
        const uMin = -1.5;
        const uMax = 1.5;

        const eps = 0.05;
        const vMin = eps;
        const vMax = Math.PI - eps;

        const du = (uMax - uMin) / uSteps;
        const dv = (vMax - vMin) / vSteps;

        // 1. U-подібні ізолінії (v = const)
        for (let j = 0; j <= vSteps; j++) {
            const v = vMin + j * dv;
            for (let i = 0; i < uSteps; i++) {
                const u1 = uMin + i * du;
                const u2 = uMin + (i + 1) * du;

                const p1 = this.calcPoint(u1, v);
                const p2 = this.calcPoint(u2, v);

                vertexList.push(...p1, ...p2);
            }
        }

        // 2. V-подібні ізолінії (u = const)
        for (let i = 0; i <= uSteps; i++) {
            const u = uMin + i * du;
            for (let j = 0; j < vSteps; j++) {
                const v1 = vMin + j * dv;
                const v2 = vMin + (j + 1) * dv;

                const p1 = this.calcPoint(u, v1);
                const p2 = this.calcPoint(u, v2);

                vertexList.push(...p1, ...p2);
            }
        }

        return vertexList;
    };

    this.BufferData = function(vertices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        this.count = vertices.length / 3;
    };

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.drawArrays(gl.LINES, 0, this.count);
    };
}