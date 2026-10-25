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

/* Проценты как на обычном калькуляторе:
   200+10% → 200+20, 200-10% → 200-20, 200*10% → 200*0.1, 50% → 0.5 */
const toEvaluable = (expression) => {
    /* «база ± N%» — процент берётся от всего, что стоит слева */
    const withBase = expression.replace(
        /^(.+)([+-])(\d+(?:\.\d+)?)%/,
        "($1)$2(($1)*$3/100)"
    );
    /* остальные «N%» — просто сотая часть */
    return withBase.replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
};

const evaluate = (expression) => eval(toEvaluable(expression));

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
        return roundResult(evaluate(trimmed));
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

/* Досрочное погашение: какой процент (из 44%) набегает к концу каждого месяца */
const EARLY_PERCENTS = [0, 7, 11, 15, 18, 22, 26, 29, 33, 37, 40, 44];

/* Процент досрочного погашения для месяца m из n: таблица растягивается на любой срок */
const earlyPercent = (month, months, lastRate) => {
    const last = EARLY_PERCENTS.length - 1;
    const position = months > 1 ? ((month - 1) / (months - 1)) * last : 0;
    const low = Math.floor(position);
    const high = Math.min(low + 1, last);
    const share = EARLY_PERCENTS[low] + (EARLY_PERCENTS[high] - EARLY_PERCENTS[low]) * (position - low);
    return Math.round((share / EARLY_PERCENTS[last]) * lastRate * 100) / 100;
};

/* Небольшое хранилище в localStorage — если недоступно, просто не сохраняем */
const store = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch { /* хранилище недоступно */ }
    },
};

const HISTORY_LIMIT = 8;

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
    const [history, setHistory] = useState(() => store.get("calc-history", []))
    const displayRef = useRef(null)

    const pushHistory = (expression, result) => {
        setHistory((prev) => {
            const next = [{ expression, result }, ...prev].slice(0, HISTORY_LIMIT);
            store.set("calc-history", next);
            return next;
        });
    };

    const clearHistory = () => {
        setHistory([]);
        store.set("calc-history", []);
    };

    const handleInput = (vale) => {
        setActive((prev) => ({ value: vale, id: prev.id + 1 }))

        if (vale === "C") {
            setDisplay("")
        } else if (vale === "⌫") {
            setDisplay((perv) => perv.slice(0, -1));
        } else if (vale === "=") {
            const expression = displayRef.current?.dataset.raw ?? "";
            let result;
            try {
                result = roundResult(evaluate(expression));
            } catch {
                result = null;
            }
            if (result !== null && result !== undefined && expression !== result) {
                pushHistory(expression, result);
            }
            setDisplay(result ?? "ЕЙ ТЫ ЧЕГО");
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
            const sum = Number(roundResult(evaluate(currentValue())));
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

            {history.length > 0 && (
                <div className="calc__history">
                    <div className="calc__history-head">
                        <span>История</span>
                        <button type="button" onClick={clearHistory}>Очистить</button>
                    </div>
                    <ul>
                        {history.map(({ expression, result }, index) => (
                            <li key={index}>
                                <button
                                    type="button"
                                    onClick={() => setDisplay(result)}
                                    title="Подставить результат"
                                >
                                    <span>{formatExpression(expression)}</span>
                                    <b>= {formatExpression(result)}</b>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="calc__tip">
                С клавиатуры: <b>0–9</b> · <b>+ − * /</b> · <b>Enter</b> — результат ·{" "}
                <b>Backspace</b> — стереть · <b>Esc</b> — сброс ·{" "}
                <b>Ctrl+C</b> / <b>Ctrl+V</b> — копировать / вставить
            </p>
        </div>
    );
};

/* Микрозайм: сумма → +5% → +44% (каждая наценка на предыдущий итог) */
const DEFAULT_SETTINGS = {
    months: String(MICROLOAN_MONTHS),
    rate1: String(MICROLOAN_RATES[0]),
    rate2: String(MICROLOAN_RATES[1]),
};

/* Число из поля с запасным значением и границами */
const toNumber = (text, fallback, min, max) => {
    const value = Number(text);
    if (text === "" || !Number.isFinite(value)) return fallback;
    return Math.min(Math.max(value, min), max);
};

const MicroLoan = ({ initialSum, onBack }) => {
    /* Пришла сумма с калькулятора — берём её, иначе последнюю сохранённую */
    const [sum, setSum] = useState(() => initialSum || store.get("loan-sum", ""))
    const [settings, setSettings] = useState(() => ({
        ...DEFAULT_SETTINGS,
        ...store.get("loan-settings", {}),
    }))
    const [result, setResult] = useState(null)
    const [earlyOpen, setEarlyOpen] = useState(false)
    const [copiedMonth, setCopiedMonth] = useState(null)

    const handleChange = (event) => {
        const clean = event.target.value
            .replace(/\s/g, "")
            .replace(/,/g, ".")
            .replace(/[^\d.]/g, "")
            .replace(/^(\d*\.\d*)\./, "$1");
        setSum(clean);
        store.set("loan-sum", clean);
        setResult(null);
    };

    const handleSetting = (name) => (event) => {
        const value = event.target.value.replace(/,/g, ".").replace(/[^\d.]/g, "");
        setSettings((prev) => {
            const next = { ...prev, [name]: value };
            store.set("loan-settings", next);
            return next;
        });
        setResult(null);
    };

    const calculate = () => {
        const base = Number(sum);
        if (!Number.isFinite(base) || base <= 0) return;

        const months = Math.round(toNumber(settings.months, MICROLOAN_MONTHS, 1, 60));
        const rates = [
            toNumber(settings.rate1, MICROLOAN_RATES[0], 0, 1000),
            toNumber(settings.rate2, MICROLOAN_RATES[1], 0, 1000),
        ];

        let total = base;
        const steps = rates.map((rate) => {
            const extra = Math.round(total * rate) / 100;
            total = Math.round((total + extra) * 100) / 100;
            return { rate, extra, total };
        });
        const monthly = Math.round((total / months) * 100) / 100;
        /* Сумма после первой наценки; вторая наценка берётся не целиком, а по месяцам */
        const afterFirst = steps[0].total;
        const early = Array.from({ length: months }, (_, index) => {
            const percent = earlyPercent(index + 1, months, rates[1]);
            /* К месяцу m уже внесено m−1 ежемесячных платежей — они вычитаются из суммы */
            const paid = Math.round(monthly * index * 100) / 100;
            const full = Math.round(afterFirst * (100 + percent)) / 100;
            const amount = Math.max(Math.round((full - paid) * 100) / 100, 0);
            return {
                month: index + 1,
                percent,
                paid,
                amount,
                /* Экономия против остатка по обычному графику */
                saved: Math.max(Math.round((total - paid - amount) * 100) / 100, 0),
            };
        });
        store.set("loan-sum", sum);
        setResult({ base, steps, total, monthly, months, early });
    };

    const copyAmount = async (month, amount) => {
        try {
            await navigator.clipboard.writeText(String(amount));
            setCopiedMonth(month);
            setTimeout(() => setCopiedMonth((current) => (current === month ? null : current)), 1200);
        } catch { /* буфер недоступен */ }
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

            <div className="calc__settings">
                <label>
                    <span>Срок, мес.</span>
                    <input
                        value={settings.months}
                        onChange={handleSetting("months")}
                        inputMode="numeric"
                        aria-label="Срок в месяцах"
                    />
                </label>
                <label>
                    <span>Наценка 1, %</span>
                    <input
                        value={settings.rate1}
                        onChange={handleSetting("rate1")}
                        inputMode="decimal"
                        aria-label="Первая наценка в процентах"
                    />
                </label>
                <label>
                    <span>Наценка 2, %</span>
                    <input
                        value={settings.rate2}
                        onChange={handleSetting("rate2")}
                        inputMode="decimal"
                        aria-label="Вторая наценка в процентах"
                    />
                </label>
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
                        <dt>÷ {result.months} мес.</dt>
                        <dd>{groupNumber(String(result.monthly))}</dd>
                    </div>
                </dl>
            )}

            {result && (
                <div className={"calc__early-box" + (earlyOpen ? " is-open" : "")}>
                    <button
                        type="button"
                        className="calc__early-title"
                        aria-expanded={earlyOpen}
                        onClick={() => setEarlyOpen((open) => !open)}
                    >
                        Досрочное погашение
                        <span className="calc__early-arrow" aria-hidden="true">▾</span>
                    </button>
                    <div className="calc__early-body">
                        <dl className="calc__loan-table calc__early">
                            {result.early.map(({ month, percent, paid, amount, saved }) => (
                                <div
                                    key={month}
                                    className="calc__early-row"
                                    role="button"
                                    tabIndex={earlyOpen ? 0 : -1}
                                    title="Копировать сумму"
                                    onClick={() => copyAmount(month, amount)}
                                    onKeyDown={(event) => event.key === "Enter" && copyAmount(month, amount)}
                                >
                                    <dt>
                                        {month} мес. — {percent}%
                                        {paid > 0 && (
                                            <small>оплачено {groupNumber(String(paid))}</small>
                                        )}
                                    </dt>
                                    <dd>
                                        {copiedMonth === month ? "скопировано" : groupNumber(String(amount))}
                                        {saved > 0 && copiedMonth !== month && (
                                            <small>−{groupNumber(String(saved))}</small>
                                        )}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>
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
