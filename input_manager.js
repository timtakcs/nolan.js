

export class InputManager {
    // @param {HTMLCanvasElement} canvas
    constructor(canvas) {
        this.canvas = canvas;

        this.move_buffer = [];
        this.wheel_buffer = [];

        canvas.addEventListener("mousemove", this.mouse_move.bind(this));
        canvas.addEventListener("mousedown", this.mouse_click.bind(this));
        canvas.addEventListener("contextmenu", this.context_menu.bind(this));
        canvas.addEventListener("wheel", this.mouse_wheel.bind(this));
    }

    context_menu(event) {
        event.preventDefault();
    }

    mouse_wheel(event) {
        event.preventDefault();
        
        if (this.wheel_buffer.length >= 3) {
            this.wheel_buffer.shift();
        }

        this.wheel_buffer.push(event.deltaY);
    }

    mouse_move(event) {
        if (event.buttons === 1) {
            this.mouse_left = true;
        } else if (event.buttons === 2) {
            this.mouse_right = true;
        }

        const x = event.offsetX;
        const y = event.offsetY;

        if (this.move_buffer.length >= 3) {
            this.move_buffer.shift();
        }

        this.move_buffer.push({ x: x, y: y, button: event.buttons });
    }

    mouse_click(event) {
        console.log(event);
    }

    get_move_vector() {
        if (this.move_buffer.length < 2) {
            return { x: 0, y: 0 };
        }

        const first = this.move_buffer[0];
        const last = this.move_buffer[this.move_buffer.length - 1];

        var move = 0;
        if (last.button === 1 || last.button === 2) {
            move = 1;
        }

        this.move_buffer.push({ x: last.x, y: last.y, button: last.button });
        this.move_buffer.shift();

        return { x: (first.x - last.x) * move, y: (last.y - first.y) * move, type: last.button };
    }

    get_wheel_vector(direction) {
        // direction is a 3d vector, move along the vector by the wheel delta
        if (this.wheel_buffer.length < 2) {
            return { x: 0, y: 0, z: 0 };
        }

        const delta = this.wheel_buffer[this.wheel_buffer.length - 1];

        const direction_scalar = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2]);

        const x = 2 * direction[0] * delta / direction_scalar;
        const y = 2 * direction[1] * delta / direction_scalar;
        const z = 2 * direction[2] * delta / direction_scalar;

        this.wheel_buffer.push(0);

        if (direction_scalar < 0) {
            return {x: -x, y: -y, z: -z};
        } else {
            return {x: x, y: y, z: z};
        }
    }
}