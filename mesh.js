export function create_sphere(radius) {
    var vertices = [];
    var normals = [];
    var indices = [];

    var latitudeBands = 12;
    var longitudeBands = 12;
    var radius = radius;

    for (var latNumber = 0; latNumber <= latitudeBands; ++latNumber) {
        var theta = latNumber * Math.PI / latitudeBands;
        var sinTheta = Math.sin(theta);
        var cosTheta = Math.cos(theta);

        for (var longNumber = 0; longNumber <= longitudeBands; ++ longNumber) {
            var phi = longNumber * 2 * Math.PI / longitudeBands;
            var sinPhi = Math.sin(phi);
            var cosPhi = Math.cos(phi);

            var x = cosPhi * sinTheta;
            var y = cosTheta;
            var z = sinPhi * sinTheta;

            normals.push(x, y, z);
            vertices.push(radius * x, radius * y, radius * z);
        }
    }

    for (latNumber = 0; latNumber < latitudeBands; ++latNumber) {
        for (longNumber = 0; longNumber < longitudeBands; ++ longNumber) {
            var first = latNumber * (longitudeBands + 1) + longNumber;
            var second = first + longitudeBands + 1;
            indices.push(second, first, first + 1, second + 1, second, first + 1);
        }
    }

    return {vertices, indices, normals};
}