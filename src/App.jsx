import Calculator from "./components/Calculator/Calculator"
import Clock from "./components/Clock/Clock"
import "./App.css"

const App = () => {
    return (
        <main className="app">
            <div className="layout">
                <Clock />
                <Calculator />
            </div>
        </main>
    )
}

export default App
