import { Link } from "react-router-dom"

export default function Footer() {
  return (
    <footer className="bg-purple-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold mb-4">Mini Project Reactjs</h3>
            <p className="text-sm text-gray-300 mb-4">DHKTPM18ATT</p>
          </div>


          <div>
            <h3 className="font-semibold mb-4">Shop</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <Link to="/womens-collection">Women's Collection</Link>
              </li>
              <li>
                <Link to="/mens-collection">Men's Collection</Link>
              </li>
              <li>
                <Link to="/all-products">All Products</Link>
              </li>
            </ul>
          </div>


          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <Link to="/about">About Us</Link>
              </li>

              <li>
                <Link >Careers</Link>
              </li>
              <li>
                <Link to="/terms" >Terms & Conditions</Link>
              </li>
              <li>
                <Link to="/privacy">Privacy Policy</Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>Email: d4cShop@gmail.com</li>
              <li>Phone: 0xxxxxxx38</li>
              <li>
                Address : Đại Học Công Nghiệp TP.HCM,
                <br />
                DHKTPM18ATT
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
