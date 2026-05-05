import { Link } from '@tanstack/react-router'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-20 bg-purple-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="font-semibold mb-4 text-base">D4C Clothing Shop</h3>
            <p className="text-sm text-gray-300 mb-4">DHKTPM18ATT</p>
            <p className="text-sm text-gray-300">Mini Project Reactjs</p>
          </div>

          {/* Shop Links */}
          <div>
            <h3 className="font-semibold mb-4 text-base">Shop</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <Link to="/all-products" className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded">
                  All Products
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="font-semibold mb-4 text-base">Company</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="text-sm text-gray-300">D4C Clothing Shop</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-base">Contact Us</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>Email: d4cShop@gmail.com</li>
              <li>Phone: 0xxxxxxx38</li>
              <li>
                Address: Đại Học Công Nghiệp TP.HCM,
                <br />
                DHKTPM18ATT
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-purple-700 text-center text-sm text-gray-400">
          &copy; {year} D4C Clothing Shop. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
