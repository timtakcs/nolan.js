const { mat4, vec3, vec4 } = glMatrix;

export class Camera {
    constructor(viewport_width, viewport_height) {
        this.pos = [0, 0, 10];
        this.look_at = [0, 0, 0];

        this.translate_sensitivity = 0.01;

        this.viewport_width = viewport_width;
        this.viewport_height = viewport_height;
    }

    get_direction() {
        return [
            this.pos[0] - this.look_at[0],
            this.pos[1] - this.look_at[1],
            this.pos[2] - this.look_at[2]
        ];
    }

    get_right_vector() {
        var direction = this.get_direction();
        var up = [0, 1, 0];

        var right = vec3.cross([], direction, up);
        vec3.normalize(right, right);

        return right;
    }

    transform(mouse_movement, wheel_movement, view_matrix) {
        if (mouse_movement.type === 1) { // linear transformation
            var move = vec4.transformMat4([0, 0, 0, 0], [mouse_movement.x, mouse_movement.y, 0, 0], view_matrix);

            this.pos[0] += move[0] * this.translate_sensitivity;
            this.pos[1] += move[1] * this.translate_sensitivity;
            this.pos[2] += move[2] * this.translate_sensitivity;

            this.look_at[0] += move[0] * this.translate_sensitivity;
            this.look_at[1] += move[1] * this.translate_sensitivity;
            this.look_at[2] += move[2] * this.translate_sensitivity;

        } else if (mouse_movement.type === 2) { // rotation
            var i = mouse_movement.x;
            var j = mouse_movement.y;

            var delta_angle_x = 2 * Math.PI / this.viewport_width;
            var delta_angle_y = Math.PI / this.viewport_height;

            var angle_x = i * delta_angle_x;
            var angle_y = j * delta_angle_y;
            
            // to get lateral rotation, we always rotate about the y-axis, therefore making a rotation matrix is not necessary
            vec3.rotateY(this.pos, this.pos, this.look_at, angle_x);
            
            // to get vertical rotation, we rotate about the right vector, so some extra shenannigans are necessary
            var right = this.get_right_vector();
            var rotation_matrix_y = mat4.create();
            mat4.rotate(rotation_matrix_y, rotation_matrix_y, angle_y, right);
            var temp_pos = vec4.transformMat4([0, 0, 0, 0], [this.pos[0], this.pos[1], this.pos[2], 0], rotation_matrix_y);

            this.pos[0] = temp_pos[0];
            this.pos[1] = temp_pos[1];
            this.pos[2] = temp_pos[2];            
        }

        this.pos[0] += wheel_movement.x * this.translate_sensitivity;
        this.pos[1] += wheel_movement.y * this.translate_sensitivity;
        this.pos[2] += wheel_movement.z * this.translate_sensitivity;
    }
}