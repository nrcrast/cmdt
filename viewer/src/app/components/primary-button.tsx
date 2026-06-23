export default function Button(props: { children: React.ReactNode; className?: string; onClick?: () => void }) {
	return (
		<button
			type="button"
			className={`items-center px-3 py-2 border rounded text-muted-foreground border-border hover:border-foreground hover:border-2 ${props.className}`}
			onClick={props.onClick}
		>
			{props.children}
		</button>
	);
}
