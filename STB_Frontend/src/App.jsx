import { useEffect, useState } from "react";
import reactLogo from './assets/react.svg'
import './App.css'

function App() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("https://stbleague.fly.dev/api/test")
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => console.error("Error fetching API:", err));
  }, []);

  return (
    <div>
      <h1>React + C# API</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;
