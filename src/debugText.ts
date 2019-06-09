
export class DebugText {
    private static textBox: Element = DebugText.init();

    private static init() {
        const input = document.createElement('div');
        input.classList.add('debugOutput');
        const debugOutput = document.createElement('pre');
        debugOutput.innerHTML = '';
        document.body.appendChild(input);
        input.appendChild(debugOutput);
        return debugOutput;
    }

    static setDebugOutput(message: string) {
        DebugText.textBox.innerHTML = message;
    }

    static appendDebugOutput(message: string) {
        DebugText.textBox.innerHTML += message + '\n';
    }
}
