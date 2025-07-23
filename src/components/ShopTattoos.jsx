import React, { useState } from "react";
import "tailwindcss/tailwind.css";

const tattoos = [
  { name: "Chrona Sparkle", price: 50, image: "/chrona_sparkle.png" },
  { name: "Timeless Sass", price: 75, image: "/timeless_sass.png" },
  { name: "Clawing Out", price: 100, image: "/clawing_out.png" },
  { name: "Mini Chrona Glow", price: 30, image: "/mini_chrona_glow.png" },
  { name: "Baby Time Tickler", price: 40, image: "/baby_time_tickler.png" },
  { name: "Liquor Poker", price: 60, image: "/liquor_poker.png" },
  { name: "No Trespassing", price: 80, image: "/no_trespassing.png" },
  { name: "Chrona Stone", price: 90, image: "/chrona_stone.png" },
  { name: "Shit Never Stops", price: 70, image: "/shit_never_stops.png" },
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
      <h1 className="text-5xl font-bold mb-8 text-center">
        Eon Tramp Stamp Shop
      </h1>
      <p className="text-red-400 mb-6 text-center">
        <strong>Warning:</strong> Tattoos are 18+. Satire, not medical advice.
        [YourSite] not liable for regrets.
      </p>
      <div className="card mb-8">
        <label className="block text-lg text-gray-300 mb-2">
          Select Membership Tier:
        </label>
        <select
          value={tier}
          onChange={handleTierChange}
          className="border pearl-border bg-gray-800 text-white p-2 rounded-lg w-full md:w-1/4"
        >
          <option value="Free">Free (0% off)</option>
          <option value="Pro">Pro (10% off)</option>
          <option value="Elite">Elite (20% off)</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tattoos.map((tattoo) => (
          <div key={tattoo.name} className="card">
            <img
              src={tattoo.image}
              alt={tattoo.name}
              className="w-full h-48 object-cover rounded-lg mb-4 pearl-border"
              onError={(e) => (e.target.src = "https://picsum.photos/200/300")} // Fallback
            />
            <h2 className="text-2xl font-semibold mb-2">{tattoo.name}</h2>
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
      <div className="card mt-8">
        <h2 className="text-2xl font-semibold mb-4">Cart</h2>
        <ul className="text-gray-300">
          {cart.map((item, index) => (
            <li key={index} className="mb-2 flex justify-between items-center">
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
        <p className="text-xl text-green-400 font-bold mt-4 pearl-gradient p-2 rounded">
          Total: ${totalPrice.toFixed(2)} ({discount * 100}% discount)
        </p>
      </div>
    </div>
  );
};

export default ShopTattoos;
