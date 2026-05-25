export default function Button(props: { children: React.ReactNode; className?: string; onClick?: () => void }) {
	return (
		<button
			type="button"
			className={`items-center px-3 py-2 border rounded text-gray-500 border-gray-600 hover:border-gray-800 hover:border-2 ${props.className}`}
			onClick={props.onClick}
		>
			{props.children}
		</button>
	);
}
