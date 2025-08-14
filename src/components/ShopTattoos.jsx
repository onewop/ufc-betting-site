import React, { useState } from "react";
import { motion } from "framer-motion";
import "./ShopTattoos.css";

const tattoos = [
  { name: "Chrona Sparkle", price: 50, image: "/powtattoo.jpg" },
  {
    name: "Timeless Sass",
    price: 75,
    image: "https://images.pexels.com/photos/5486974/pexels-photo-5486974.jpeg",
  },
  {
    name: "Clawing Out",
    price: 100,
    image: "https://images.pexels.com/photos/5486974/pexels-photo-5486974.jpeg",
  },
  {
    name: "Mini Chrona Glow",
    price: 30,
    image: "https://images.pexels.com/photos/5486974/pexels-photo-5486974.jpeg",
  },
  {
    name: "Baby Time Tickler",
    price: 40,
    image: "https://images.pexels.com/photos/5486974/pexels-photo-5486974.jpeg",
  },
  {
    name: "Liquor Poker",
    price: 60,
    image: "https://images.pexels.com/photos/5486974/pexels-photo-5486974.jpeg",
  },
  {
    name: "No Trespassing",
    price: 80,
    image: "https://images.pexels.com/photos/5486974/pexels-photo-5486974.jpeg",
  },
  {
    name: "Chrona Stone",
    price: 90,
    image: "https://images.pexels.com/photos/5486974/pexels-photo-5486974.jpeg",
  },
  {
    name: "Shit Never Stops",
    price: 70,
    image: "https://images.pexels.com/photos/5486974/pexels-photo-5486974.jpeg",
  },
];

const ShopTattoos = () => {
  const [tier, setTier] = useState("Free");
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);

  const handleTierChange = (e) => {
    const selectedTier = e.target.value;
    setTier(selectedTier);
    setDiscount(
      selectedTier === "Pro" ? 0.1 : selectedTier === "Elite" ? 0.2 : 0
    );
  };

  const addToCart = (tattoo) => {
    setCart([...cart, tattoo]);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const totalPrice =
    cart.reduce((total, item) => total + item.price, 0) * (1 - discount);

  return (
    <div className="container mx-auto p-6 min-h-screen">
      <h1 className="text-5xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
        Eon Tramp Stamp Shop
      </h1>
      <p className="text-red-400 mb-6 text-center">
        <strong>Warning:</strong> Tattoos are 18+. Satire, not medical advice.
        [YourSite] not liable for regrets.
      </p>
      <div className="mb-8">
        <label className="block text-lg mb-2 text-center">
          Membership Tier
        </label>
        <select
          value={tier}
          onChange={handleTierChange}
          className="w-full max-w-xs mx-auto p-2 bg-gray-800 text-white border pearl-border rounded"
        >
          <option value="Free">Free (No Discount)</option>
          <option value="Pro">Pro (10% off)</option>
          <option value="Elite">Elite (20% off)</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tattoos.map((tattoo) => (
          <div key={tattoo.name} className="card text-center">
            <h2 className="text-2xl font-semibold mb-2">{tattoo.name}</h2>
            <img
              src={tattoo.image}
              alt={tattoo.name}
              className="w-full h-48 object-cover rounded-lg mb-4 pearl-border"
            />
            <p className="text-lg text-gray-300 mb-4">${tattoo.price}</p>
            <button
              onClick={() => addToCart(tattoo)}
              className="neon-button w-full"
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>
      <div className="card mt-8 text-center">
        <h2 className="text-2xl font-semibold mb-4">Cart</h2>
        <ul className="text-gray-300">
          {cart.map((item, index) => (
            <li
              key={index}
              className="mb-2 flex justify-between items-center max-w-md mx-auto"
            >
              <span>
                {item.name} - ${item.price}
              </span>
              <button
                onClick={() => removeFromCart(index)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xl text-green-400 font-bold mt-4 pearl-border p-2 rounded">
          Total: ${totalPrice.toFixed(2)} ({discount * 100}% discount)
        </p>
      </div>
    </div>
  );
};

export default ShopTattoos;
