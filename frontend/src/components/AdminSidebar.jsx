export default function AdminSidebar({ activeTab, setActiveTab }) {
    const tabs = ["dashboard", "products", "orders", "users"];

    return (
        <div className="w-full md:w-64 bg-gray-100 p-4 rounded-lg">
            <nav>
                <ul>
                    {tabs.map((tab) => (
                        <li key={tab} className="mb-2">
                            <button
                                className={`w-full text-left px-4 py-2 rounded ${activeTab === tab ? "bg-[#8755f2] text-white" : "hover:bg-gray-200"
                                    }`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    );
}