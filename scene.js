class Scene {
    constructor(gl, program) {
        this.gl = gl;
        this.program = program;
        this.meshes = [];
    }
    add(mesh) {
        this.meshes.push(mesh);
    }
    
}