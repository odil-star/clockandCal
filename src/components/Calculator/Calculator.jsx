import { useState, useEffect, useRef } from "react"
import "./Calculator.css"

const buttons = [
    "C", "⌫", "%", "/",
    "7", "8", "9", "*",
    "4", "5", "6", "-",
    "1", "2", "3", "+",
    "0", ".", "="
];

const operators = ["/", "*", "-", "+"];
const functions = ["C", "⌫", "%"];

/* Клавиши, у которых нет прямого совпадения с кнопкой */
const specialKeys = {
    Enter: "=",
    "=": "=",
    Backspace: "⌫",
    Delete: "C",
    Escape: "C",
    ",": ".",
    c: "C",
    C: "C",
    с: "C",
    С: "C",
};

const keyToValue = (key) => {
    if (/^[0-9]$/.test(key)) return key;
    if (buttons.includes(key)) return key;
    return specialKeys[key] ?? null;
};

/* 1234567.89 → 1 234 567.89 */
const SPACE = " ";

const groupNumber = (number) => {
    const [int, fraction] = number.split(".");
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, SPACE);
    return fraction === undefined ? grouped : `${grouped}.${fraction}`;
};

/* Разряды разделяются прямо по ходу набора: 10000+5000 → 10 000+5 000 */
const formatExpression = (expression) =>
    expression.replace(/\d+(\.\d+)?/g, groupNumber);

/* Убираем хвост вида 0.30000000000000004 */
const roundResult = (value) => {
    if (!Number.isFinite(value)) return null;
    return String(Math.round(value * 1e10) / 1e10);
};

/* Промежуточный ответ: считается на каждое действие, пока набирается выражение */
const previewResult = (expression) => {
    /* В строке только цифры и знаки — иначе считать нечего */
    if (!/^[\d+\-*/%.]+$/.test(expression)) return null;

    /* Отбрасываем незаконченный хвост: "120+" → "120" */
    const trimmed = expression.replace(/[+\-*/%.]+$/, "");

    /* Без второго операнда ответ совпадает с вводом — не показываем */
    if (!trimmed || !/[+\-*/%]/.test(trimmed.slice(1))) return null;

    try {
        return roundResult(eval(trimmed));
    } catch {
        return null;
    }
};

/* Чем длиннее число, тем мельче шрифт — строка не обрезается */
const displaySizeClass = (text) => {
    if (text.length > 20) return " is-tiny";
    if (text.length > 13) return " is-small";
    return "";
};

/* Из буфера оставляем только то, что умеет калькулятор: 1 234,5 → 1234.5 */
const sanitizePasted = (text) =>
    text.replace(/\s/g, "").replace(/,/g, ".").replace(/[^\d+\-*/%.]/g, "");

/* Микрозайм: наценка в процентах от текущей суммы */
const MICROLOAN_RATES = [5, 44];
const MICROLOAN_MONTHS = 12;

const buttonClass = (value) => {
    if (value === "=") return "calc__key calc__key--equals";
    if (operators.includes(value)) return "calc__key calc__key--op";
    if (functions.includes(value)) return "calc__key calc__key--fn";
    if (value === "0") return "calc__key calc__key--wide";
    return "calc__key";
};

const BasicCalculator = ({ onMicroloan }) => {
    const [display, setDisplay] = useState("")
    const [active, setActive] = useState({ value: null, id: 0 })
    const displayRef = useRef(null)

    const handleInput = (vale) => {
        setActive((prev) => ({ value: vale, id: prev.id + 1 }))

        if (vale === "C") {
            setDisplay("")
        } else if (vale === "⌫") {
            setDisplay((perv) => perv.slice(0, -1));
        } else if (vale === "=") {
            setDisplay((prev) => {
                try {
                    return roundResult(eval(prev)) ?? "ЕЙ ТЫ ЧЕГО"
                } catch {
                    return "ЕЙ ТЫ ЧЕГО"
                }
            });
        } else {
            setDisplay((prev) => prev + vale)
        }
    }

    /* Текущая сумма: готовый ответ, а если выражение не закончено — промежуточный */
    const currentValue = () => {
        const text = displayRef.current?.dataset.raw ?? "";
        if (!text) return "";
        return previewResult(text) ?? text;
    };

    const insertText = (text) => {
        const clean = sanitizePasted(text);
        if (clean) setDisplay((prev) => prev + clean);
    };

    const copyValue = async () => {
        const value = currentValue();
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
        } catch { /* буфер недоступен */ }
    };

    const pasteValue = async () => {
        try {
            insertText(await navigator.clipboard.readText());
        } catch { /* нет доступа к буферу */ }
    };

    /* Открываем экран микрозайма, подставив текущую сумму */
    const openMicroloan = () => {
        try {
            const sum = Number(roundResult(eval(currentValue())));
            onMicroloan(Number.isFinite(sum) && sum > 0 ? String(sum) : "");
        } catch {
            onMicroloan("");
        }
    };

    /* Ctrl+C / Ctrl+V */
    useEffect(() => {
        const handleCopy = (event) => {
            const value = currentValue();
            if (!value || window.getSelection()?.toString()) return;
            event.clipboardData.setData("text/plain", value);
            event.preventDefault();
        };

        const handlePaste = (event) => {
            event.preventDefault();
            insertText(event.clipboardData.getData("text"));
        };

        document.addEventListener("copy", handleCopy);
        document.addEventListener("paste", handlePaste);
        return () => {
            document.removeEventListener("copy", handleCopy);
            document.removeEventListener("paste", handlePaste);
        };
    }, []);

    /* Ввод с физической клавиатуры */
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;

            const value = keyToValue(event.key);
            if (!value) return;

            event.preventDefault();
            handleInput(value);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    /* Подсветка нажатой клавиши гаснет сама */
    useEffect(() => {
        if (!active.value) return;

        const timeout = setTimeout(() => {
            setActive((prev) => ({ ...prev, value: null }));
        }, 160);

        return () => clearTimeout(timeout);
    }, [active]);

    const formatted = formatExpression(display);
    const preview = previewResult(display);

    /* Длинную строку прокручиваем к концу — виден свежий ввод */
    useEffect(() => {
        const field = displayRef.current;
        if (field) field.scrollLeft = field.scrollWidth;
    }, [formatted]);

    return (
        <div className="calculator">
            <button
                type="button"
                className="calc__action calc__action--loan"
                onClick={openMicroloan}
            >
                Микрозайм
            </button>

            <div className="calc__screen">
                <span className="calc__hint">Выражение</span>
                <input
                    ref={displayRef}
                    className={"calc__display" + displaySizeClass(formatted)}
                    value={formatted}
                    data-raw={display}
                    placeholder="0"
                    readOnly
                    aria-label="Результат вычисления"
                />

                <div className="calc__preview" aria-live="polite">
                    {preview !== null && (
                        <span>= {formatExpression(preview)}</span>
                    )}
                </div>
            </div>

            <div className="calc__clip">
                <button type="button" className="calc__action" onClick={copyValue}>
                    Копировать
                </button>
                <button type="button" className="calc__action" onClick={pasteValue}>
                    Вставить
                </button>
            </div>

            <div className="calc__keys">
                {buttons.map((button) => (
                    <button
                        key={button}
                        type="button"
                        className={
                            buttonClass(button) +
                            (active.value === button ? " is-active" : "")
                        }
                        onClick={() => handleInput(button)}
                        aria-label={button === "⌫" ? "Удалить символ" : button}
                    >
                        {button}
                    </button>
                ))}
            </div>

            <p className="calc__tip">
                С клавиатуры: <b>0–9</b> · <b>+ − * /</b> · <b>Enter</b> — результат ·{" "}
                <b>Backspace</b> — стереть · <b>Esc</b> — сброс ·{" "}
                <b>Ctrl+C</b> / <b>Ctrl+V</b> — копировать / вставить
            </p>
        </div>
    );
};

/* Микрозайм: сумма → +5% → +44% (каждая наценка на предыдущий итог) */
const MicroLoan = ({ initialSum, onBack }) => {
    const [sum, setSum] = useState(initialSum)
    const [result, setResult] = useState(null)

    const handleChange = (event) => {
        const clean = event.target.value
            .replace(/\s/g, "")
            .replace(/,/g, ".")
            .replace(/[^\d.]/g, "")
            .replace(/^(\d*\.\d*)\./, "$1");
        setSum(clean);
        setResult(null);
    };

    const calculate = () => {
        const base = Number(sum);
        if (!Number.isFinite(base) || base <= 0) return;

        let total = base;
        const steps = MICROLOAN_RATES.map((rate) => {
            const extra = Math.round(total * rate) / 100;
            total = Math.round((total + extra) * 100) / 100;
            return { rate, extra, total };
        });
        const monthly = Math.round((total / MICROLOAN_MONTHS) * 100) / 100;
        setResult({ base, steps, total, monthly });
    };

    return (
        <div className="calculator calculator--loan">
            <div className="calc__screen">
                <span className="calc__hint">Микрозайм · введите сумму</span>
                <input
                    className={"calc__display" + displaySizeClass(groupNumber(sum))}
                    value={groupNumber(sum)}
                    onChange={handleChange}
                    onKeyDown={(event) => event.key === "Enter" && calculate()}
                    placeholder="0"
                    inputMode="decimal"
                    autoFocus
                    aria-label="Сумма займа"
                />
                <div className="calc__preview" />
            </div>

            <button
                type="button"
                className="calc__key calc__key--equals calc__key--cta"
                onClick={calculate}
            >
                Посчитать
            </button>

            {result && (
                <dl className="calc__loan-table">
                    <div>
                        <dt>Сумма</dt>
                        <dd>{groupNumber(String(result.base))}</dd>
                    </div>
                    {result.steps.map(({ rate, extra, total }) => (
                        <div key={rate}>
                            <dt>+ {rate}% ({groupNumber(String(extra))})</dt>
                            <dd>{groupNumber(String(total))}</dd>
                        </div>
                    ))}
                    <div>
                        <dt>÷ {MICROLOAN_MONTHS} мес.</dt>
                        <dd>{groupNumber(String(result.monthly))}</dd>
                    </div>
                </dl>
            )}

            <button type="button" className="calc__action" onClick={onBack}>
                ← Калькулятор
            </button>
        </div>
    );
};

const Calculator = () => {
    const [loanSum, setLoanSum] = useState(null)

    return loanSum === null ? (
        <BasicCalculator onMicroloan={setLoanSum} />
    ) : (
        <MicroLoan initialSum={loanSum} onBack={() => setLoanSum(null)} />
    );
};

export default Calculator;
