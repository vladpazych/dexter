/**
 * Polymorphic output — build once, render to any format.
 *
 * Five node kinds form a document tree.
 * Four output modes produce strings for different consumers.
 */

export type Style = "bold" | "dim" | "red" | "green" | "yellow" | "blue" | "cyan" | "magenta" | "gray"

export type Primitive = string | number | boolean

export type TextNode = {
  readonly kind: "text"
  readonly value: string
  readonly style?: Style
}

export type FieldNode = {
  readonly kind: "field"
  readonly label: string
  readonly value: Primitive | Node
}

export type BlockNode = {
  readonly kind: "block"
  readonly tag: string
  readonly attrs?: Readonly<Record<string, string>>
  readonly children: readonly Node[]
}

export type ListNode = {
  readonly kind: "list"
  readonly tag?: string
  readonly items: readonly Node[]
}

export type HeadingNode = {
  readonly kind: "heading"
  readonly text: string
}

export type Node = TextNode | FieldNode | BlockNode | ListNode | HeadingNode

export type OutputMode = "cli" | "json" | "xml" | "md"
