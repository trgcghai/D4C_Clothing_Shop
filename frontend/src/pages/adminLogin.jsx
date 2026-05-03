import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const handleLogin = () => {
        // Kiểm tra thông tin đăng nhập (ví dụ chỉ cần một điều kiện đơn giản)
        if (username === "admin" && password === "password") {
            localStorage.setItem("adminLoggedIn", "true");
            navigate("/admin");
        } else {
            alert("Invalid credentials");
        }
    };

    return (
        <div className="login-container">
            <h2>Admin Login</h2>
            <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={handleLogin}>Login</button>
        </div>
    );
}
