export function preprocessWGSL(source: string, defines: Record<string, boolean>): string {
    const lines = source.split('\n');
    const output: string[] = [];

    interface ConditionalFrame {
        parentActive: boolean;
        condition: boolean;
        elseSeen: boolean;
    }

    const stack: ConditionalFrame[] = [];
    let currentActive = true;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('#ifdef')) {
            const match = trimmed.match(/#ifdef\s+(\w+)/);
            if (match) {
                const symbol = match[1];
                const condition = !!defines[symbol];
                stack.push({ parentActive: currentActive, condition, elseSeen: false });
                currentActive = currentActive && condition;
            }
            continue;
        }

        if (trimmed.startsWith('#ifndef')) {
            const match = trimmed.match(/#ifndef\s+(\w+)/);
            if (match) {
                const symbol = match[1];
                const condition = !defines[symbol];
                stack.push({ parentActive: currentActive, condition, elseSeen: false });
                currentActive = currentActive && condition;
            }
            continue;
        }

        if (trimmed.startsWith('#else')) {
            if (stack.length === 0) continue;
            const frame = stack[stack.length - 1];
            if (!frame.elseSeen) {
                frame.elseSeen = true;
                currentActive = frame.parentActive && !frame.condition;
            } else {
                currentActive = false;
            }
            continue;
        }

        if (trimmed.startsWith('#endif')) {
            if (stack.length === 0) continue;
            currentActive = stack[stack.length - 1].parentActive;
            stack.pop();
            continue;
        }

        if (currentActive) {
            output.push(line);
        }
    }

    return output.join('\n');
}
