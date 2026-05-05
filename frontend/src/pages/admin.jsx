import { useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import DashboardOverview from "../components/DashboardOverview";
import AddProduct from "../components/addProducts";
import ProductManager from "../components/productManager";
import { useProductsListQuery } from "../hooks/useProducts";

export default function Admin() {
    const [activeTab, setActiveTab] = useState("dashboard");
    const { data, isLoading, error } = useProductsListQuery({ limit: 1000, page: 1 });
    const products = (data?.data || []).map((item) => ({
        id: item.id,
        name: item.name || "Unknown",
        price: item.price || 0,
        stock: item.stock || 0,
    }));

    if (isLoading) {
        return <div className="text-center py-10">Đang tải...</div>;
    }

    if (error) {
        return <div className="text-center py-10 text-red-600">Lỗi khi tải dữ liệu: {error.message}</div>;
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
