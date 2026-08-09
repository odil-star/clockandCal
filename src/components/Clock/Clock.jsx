import { useState, useEffect } from "react";
import "./Clock.css";

const pad = (value) => String(value).padStart(2, "0");

const Clock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const hours = pad(time.getHours());
    const minutes = pad(time.getMinutes());
    const seconds = pad(time.getSeconds());

    const date = time.toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });

    return (
        <div className="clock">
            <time className="clock__time" dateTime={`${hours}:${minutes}:${seconds}`}>
                <span className="clock__unit">
                    {hours}
                    <span className="clock__label">часы</span>
                </span>
                <span className="clock__sep">:</span>
                <span className="clock__unit">
                    {minutes}
                    <span className="clock__label">минуты</span>
                </span>
                <span className="clock__unit clock__unit--sec">
                    {seconds}
                    <span className="clock__label">сек</span>
                </span>
            </time>

            <div
                className="clock__progress"
                style={{ "--progress": time.getSeconds() / 59 }}
            />

            <div className="clock__date">{date}</div>
        </div>
    );
};

export default Clock;
