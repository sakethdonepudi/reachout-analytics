"use client";
import NavCore, { type NavCoreProps } from "./nav-core";
export default function ClientNavbar(props: Omit<NavCoreProps, "variant">) { return <NavCore variant="client" {...props} />; }
