import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";

// Đăng ký Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function DashboardOverview({ products, orders }) {
    // Tính toán dữ liệu cho biểu đồ
    const getOrderChartData = () => {
        const currentYear = 2025;
        const months = Array(12).fill(0);

        orders.forEach((order) => {
            const orderDate = new Date(order.date);
            if (orderDate.getFullYear() === currentYear) {
                const month = orderDate.getMonth();
                months[month] += 1;
            }
        });

        return {
            labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            datasets: [
                {
                    label: "Số lượng đơn hàng",
                    data: months,
                    backgroundColor: "rgba(135, 85, 242, 0.6)",
                    borderColor: "rgba(135, 85, 242, 1)",
                    borderWidth: 1,
                },
            ],
        };
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: "top" },
            title: { display: true, text: "Số lượng đơn hàng trong năm 2025" },
        },
    };

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Dashboard Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-100 p-4 rounded-lg">
                    <h3 className="font-medium text-blue-800">Total Products</h3>
                    <p className="text-2xl font-bold">{products.length}</p>
                </div>
                <div className="bg-green-100 p-4 rounded-lg">
                    <h3 className="font-medium text-green-800">Total Orders</h3>
                    <p className="text-2xl font-bold">{orders.length}</p>
                </div>
                <div className="bg-purple-100 p-4 rounded-lg">
                    <h3 className="font-medium text-purple-800">Total Revenue</h3>
                    <p className="text-2xl font-bold text-purple-900">
                        {orders.reduce((sum, order) => sum + (order.total || 0), 0).toLocaleString("vi-VN")} đ
                    </p>
                </div>
            </div>
            <h3 className="font-semibold mb-2">Order Statistics</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
                <Bar data={getOrderChartData()} options={chartOptions} />
            </div>
        </div>
    );
}