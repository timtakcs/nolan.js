const { mat2, mat2d, mat4, mat3, quat, quat2, vec2, vec3, vec4 } = glMatrix;

class Node {
    constructor() {
        this.mass = 0;
        this.center = vec3.create();
        this.max_point = vec3.create();
        this.min_point = vec3.create();
        this.body = null;
        this.children = null;
    }
}

// Building the tree

function find_bounds(objects) {
    if (objects.length === 0) return null;

    var max_point = vec3.clone(objects[0].position);
    var min_point = vec3.clone(objects[0].position);

    for (var i = 1; i < objects.length; i++) {
        var pos = objects[i].position;
        if (pos[0] > max_point[0]) max_point[0] = pos[0];
        if (pos[1] > max_point[1]) max_point[1] = pos[1];
        if (pos[2] > max_point[2]) max_point[2] = pos[2];

        if (pos[0] < min_point[0]) min_point[0] = pos[0];
        if (pos[1] < min_point[1]) min_point[1] = pos[1];
        if (pos[2] < min_point[2]) min_point[2] = pos[2];
    }

    return {max_point, min_point};
}

function get_index(node, pos) {
    var index = 0;

    if (pos[0] > node.center[0]) index += 4;
    if (pos[1] > node.center[1]) index += 2;
    if (pos[2] > node.center[2]) index += 1;

    return index;
}

function subdivide(node) {
    node.children = new Array(8).fill(null);

    const half_lengths = [
        (node.max_point[0] - node.min_point[0]) / 2,
        (node.max_point[1] - node.min_point[1]) / 2,
        (node.max_point[2] - node.min_point[2]) / 2,

    ];
    
    for (var i = 0; i < 8; i++) {
        node.children[i] = new Node();
        let child = node.children[i];

        for (var j = 0; j < 3; j++) {
            if (i & (4 >> j)) {
                child.min_point[j] = node.center[j];
                child.max_point[j] = node.center[j] + half_lengths[j];
            } else {
                child.min_point[j] = node.center[j] - half_lengths[j];
                child.max_point[j] = node.center[j];
            }
        }

        child.center = vec3.fromValues(
            (child.max_point[0] + child.min_point[0]) / 2,
            (child.max_point[1] + child.min_point[1]) / 2,
            (child.max_point[2] + child.min_point[2]) / 2,
        );
    }
}

function insert(body, node) {
    if (node.children === null) {
        if (node.body === null) {
            node.body = body;
        } else {
            const cur_body = node.body;
            subdivide(node);
            node.body = null;
            insert(cur_body, node);
            insert(body, node);
        }
    } else {
        var index = get_index(node, body.position);
        insert(body, node.children[index]);
    }
}

export function build_tree(objects) {
    var root = new Node();

    var bounds = find_bounds(objects);
    root.max_point = bounds.max_point;
    root.min_point = bounds.min_point;

    const centerx = (root.max_point[0] + root.min_point[0]) / 2;
    const centery = (root.max_point[1] + root.min_point[1]) / 2;
    const centerz = (root.max_point[2] + root.min_point[2]) / 2;

    root.center = vec3.fromValues(centerx, centery, centerz);

    for (var i = 0; i < objects.length; i++) {
        insert(objects[i], root);
    }
    
    return root;
}

export function print_tree(root) {
    console.log(root.max_point, root.min_point, root.center);
    if (root.children !== null) {
        for (var i = 0; i < 8; i++) {
            print_tree(root.children[i]);
        }
    }
}