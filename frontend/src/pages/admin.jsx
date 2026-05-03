import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
import AdminSidebar from "../components/AdminSidebar";
import DashboardOverview from "../components/DashboardOverview";
import AddProduct from "../components/addProducts";
import ProductManager from "../components/productManager";

export default function Admin() {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const isLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
        if (!isLoggedIn) {
            localStorage.setItem("adminLoggedIn", "true");
        }

        const fetchData = async () => {
            try {
                setLoading(true);

                // Lấy products từ Backend Node.js
                const productsRes = await fetch(`${API_URL}/products?limit=1000`);
                let productsData = [];
                if (productsRes.ok) {
                    const json = await productsRes.json();
                    const items = json.data || json; // support both paginated and plain array
                    productsData = (Array.isArray(items) ? items : []).map(item => ({
                        id: item.id,
                        name: item.name || "Unknown",
                        price: item.price || 0,
                        stock: item.stock || 0,
                    }));
                }
                setProducts(productsData);

                // Lấy orders... bị loại bỏ cho product service
            } catch (err) {
                setError("Lỗi khi tải dữ liệu: " + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("adminLoggedIn");
        navigate("/admin/login");
    };

    if (loading) {
        return <div className="text-center py-10">Đang tải...</div>;
    }

    if (error) {
        return <div className="text-center py-10 text-red-600">{error}</div>;
    }

    return (
        <div className="container px-4 py-8 mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="flex-1 bg-white p-6 rounded-lg shadow">
                    {activeTab === "dashboard" && <DashboardOverview products={products} orders={[]} />}
                    {activeTab === "products" && <AddProduct /> && <ProductManager />}
                </div>
            </div>
        </div>
    );
}