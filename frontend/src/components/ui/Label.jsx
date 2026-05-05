export default function Label({ className = "", htmlFor, children, ...props }) {
  return (
    <label htmlFor={htmlFor} className={`mb-1 block text-sm font-medium text-gray-800 ${className}`} {...props}>
      {children}
    </label>
  );
}

