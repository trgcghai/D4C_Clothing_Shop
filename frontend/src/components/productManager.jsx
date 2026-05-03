import { useState } from "react";
import AddProductForm from "./addProducts";
import EditProductForm from "./editProductForm";
import DeleteProductPanel from "./deleteProductPanel";

export default function ProductManager() {
  const [tab, setTab] = useState("add");
  const [editingProductId, setEditingProductId] = useState(null);
  const [formData, setFormData] = useState(null);

  const handleEditClick = (product) => {
    setEditingProductId(product.id);
    setFormData(product);
    setTab("edit");
  };

  const handleSubmitSuccess = () => {
    setEditingProductId(null);
    setFormData(null);
    setTab("delete");
  };

  const tabStyle = (active) =>
    `px-4 py-2 rounded-md text-sm font-medium border ${active
      ? "bg-violet-600 text-white border-violet-600"
      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
    }`;

  return (
    <div className="w-full p-6 bg-white rounded-md shadow">
      <h2 className="text-xl font-semibold mb-4">Quản lý sản phẩm</h2>

      <div className="flex space-x-2 mb-6">
        <button onClick={() => setTab("add")} className={tabStyle(tab === "add")}>
          Thêm sản phẩm
        </button>
        <button onClick={() => setTab("delete")} className={tabStyle(tab === "delete")}>
          Sửa / Xoá sản phẩm
        </button>
      </div>

      <div>
        {tab === "add" && <AddProductForm onSubmitSuccess={handleSubmitSuccess} />}
        {tab === "edit" && (
          <EditProductForm
            formData={formData}
            setFormData={setFormData}
            editingProductId={editingProductId}
            onSubmitSuccess={handleSubmitSuccess}
          />
        )}
        {tab === "delete" && <DeleteProductPanel onEditClick={handleEditClick} />}
      </div>
    </div>
  );
}
