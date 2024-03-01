import { useContext, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_CHATROOM_DATA } from "../GraphQL/Queries";
import { EDIT_MESSAGE, SEND_MESSAGE } from "../GraphQL/Mutations";
import { useParams } from "react-router-dom";
import { Context } from "../context/Context";
import { useInView } from "react-intersection-observer";
import Loading from "../components/Loading";

function MessageToPerson() {
	const { id } = useParams();
	const { ref, inView } = useInView();
	const { socket } = useContext(Context);
	const Ctx = useContext(Context);
	// const [ msgStore.current, setmsgStore.current ] = useState([])
	const [rerender, setRerender] = useState(false);
	const recipient = useRef();
	const contentRef = useRef();
	const msgStore = useRef([]);
	const [msgState, setMsgState] = useState(msgStore.current);

	const { loading, error, data } = useQuery(GET_CHATROOM_DATA, {
		variables: {
			id: Ctx.id,
			secretkey: Ctx.secretkey,
			chatId: id,
		},
	});
	const [sendMessage, { dataMain, errorMain, loadingMain }] =
		useMutation(SEND_MESSAGE);
	const [editMessage, { dataEdit, errorEdit, loadingEdit }] =
		useMutation(EDIT_MESSAGE);

	// if(loading) return <Loading />
	if (error) alert("Error Loading Chatroom Data");
	if (errorMain) alert("Error Editing Chat");

	async function send() {
		if (contentRef.current.value == "") return;
		sendMessage({
			variables: {
				id: Ctx.id,
				secretkey: Ctx.secretkey,
				content: contentRef.current.value,
				chatroom: id,
			},
		});
		contentRef.current.value = "";
	}

	async function edit(type, msg) {
		const res = await editMessage({
			variables: {
				id: Ctx.id,
				secretkey: Ctx.secretkey,
				edit: type,
				chatroom: id,
				message: msg,
			},
		});
	}

	useEffect(() => {
		const handleUpdatedChat = (data) => {
			if (
				msgStore.current.length > 0 &&
				msgStore.current[msgStore.current.length - 1]?.id == data?.id
			) {
				return;
			} else {
				msgStore.current = [...msgStore.current, data];
				setMsgState(msgStore.current);
			}
		};

		socket.on("chatroom", handleUpdatedChat);
		socket.on("updatedChat", handleUpdatedChat);

		return () => {
			socket.off("chatroom", handleUpdatedChat);
			socket.off("updatedChat", handleUpdatedChat);
		};
	}, []);

	useEffect(() => {
		// Scroll to bottom of message container
		const messageContainer = document.querySelector(".msgContainer");
		messageContainer.scrollTop = messageContainer.scrollHeight;
	}, [msgStore.current]);

	useEffect(() => {
		if (
			inView &&
			msgStore.current[msgStore.current.length - 1]?.sender?.id !== Ctx.id
		) {
			edit("read", msgStore.current[msgStore.current.length - 1].id);
			// setFocus(false)
		}
	}, [inView]);

	useEffect(() => {
		if (data?.getChatroomData?.messages) {
			msgStore.current = data?.getChatroomData?.messages.map(
				(msg, i) =>
					data?.getChatroomData?.messages[
						data?.getChatroomData?.messages.length - 1 - i
					]
			);
			recipient.current = data?.getChatroomData?.chatroomUsers.find(
				(us) => us.id !== Ctx.id && us.name
			);
			setMsgState(msgStore.current);
			console.log(data?.getChatroomData?.messages);
		}
	}, [loading]);

	function DateEl({ msg, msgTwo }) {
		const difference = (msgTwo.date - msg.date) / (100 * 60);

		const date1 = new Date(parseInt(msg.date));
		const date2 = new Date(parseInt(msgTwo.date));

		if (difference > 24 * 60 || date1.getDay() !== date2.getDay()) {
			const date = new Date(parseInt(msg.date));
			const current = new Date(Date.now());
			const days = [
				"Sunday",
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
				"Saturday",
			];
			const months = [
				"Jan",
				"Feb",
				"Mar",
				"Apr",
				"May",
				"Jun",
				"Jul",
				"Aug",
				"Sep",
				"Oct",
				"Nov",
				"Dec",
			];
			const day =
				Math.abs(current - date) > 24 * 60 * 1000
					? days[date.getDay()]
					: "";
			const dte =
				Math.abs(current - date) > 24 * 7 * 60 * 1000
					? date.getDate()
					: "";
			const month =
				date.getMonth == current.getMonth
					? ""
					: months[date.getMonth()];
			const hours = date.getHours();
			const minutes = date.getMinutes();
			const time = hours + ":" + minutes;
			const dateStr = day + " " + dte + " " + month + " " + time;

			return (
				<p
					style={{
						textAlign: "center",
						marginTop: 16,
						marginBottom: 8,
						fontSize: 10,
						lineHeight: "16px",
						color: "#454542",
					}}
				>
					{dateStr}
				</p>
			);
		}
	}

	function postImage() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.click();
		input.onchange = async () => {
			const file = input.files[0];
			const reader = new FileReader();
			reader.readAsArrayBuffer(file);
			reader.onload = async (e) => {
				const res = await sendMessage({
					variables: {
						id: Ctx.id,
						secretkey: Ctx.secretkey,
						content: "You have been sent an image",
						chatroom: id,
						type: "image",
					},
				});
				const uint8Array = new Uint8Array(e.target.result);

				fetch(Ctx.imageServer + "/upload", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						id: res?.data?.sendMessage?.id,
						image: String(uint8Array),
						correlation: "Chat",
					}),
				}).then(() => window.location.reload());
			};
		};
	}

	return (
		<>
			<section
				style={{
					display: "flex",
					flexDirection: "column-reverse",
					height: "calc(100svh - 144px)",
					margin: "72px 0 40px",
					boxSizing: "border-box",
					overflowY: "scroll",
					overflowX: "hidden",
				}}
				className="message-container"
			>
				<div style={styles.input}>
					<img
						onClick={() => send()}
						src="/send.svg"
						alt="Send Message"
					/>
					<input
						ref={contentRef}
						type="text"
						placeholder="|Message"
					/>
					<img
						src="/image.svg"
						onClick={() => postImage()}
						alt="Send Image"
					/>
					<img src="/attach.svg" alt="Send File" />
				</div>

				{/* <div key={index} ref={index == 0 ? ref : null} style={ msgStore.current[msgStore.current.length - 1 - index]?.sender?.id === Ctx.id ? {width: "100%", display: "flex", justifyContent: "flex-end"} : null}><div><p style={{...styles.msg}}>{msgStore.current[msgStore.current.length - 1 - index]?.content}</p><p>{index == 0 && msgStore.current[msgStore.current.length - 1 - index]?.read && msgStore.current[msgStore.current.length - 1 - index]?.sender?.id == Ctx.id ? "Read" : null}</p></div></div> */}
				<div className="msgContainer">
					{msgState.length > 0 &&
						msgState.map((cont, index) => {
							if (index !== msgState.length - 1 && index !== 0) {
								if (cont.sender.id !== Ctx.id) {
									if (
										index + 1 < msgStore.current.length &&
										msgStore.current[index + 1].sender
											.id !== cont.sender.id &&
										msgStore.current[index - 1].sender
											.id !== cont.sender.id
									) {
										return (
											<>
												<DateEl
													msg={cont}
													msgTwo={
														msgStore.current[
															index - 1
														]
													}
												/>
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-start",
													}}
												>
													<div>
														<p
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"4px 8px 8px 4px",
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																		height: 200,
																		width: 200,
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											</>
										);
									} else if (
										index + 1 < msgStore.current.length &&
										cont.sender.id ===
											msgStore.current[index + 1].sender
												.id &&
										cont.sender.id ===
											msgStore.current[index - 1].sender
												.id
									) {
										return (
											<>
												<DateEl
													msg={cont}
													msgTwo={
														msgStore.current[
															index - 1
														]
													}
												/>
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-start",
													}}
												>
													<div>
														<p
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"4px 8px 8px 4px",
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id}) cover`,
																		height: 200,
																		width: 200,
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											</>
										);
									} else if (
										index + 1 < msgStore.current.length &&
										cont.sender.id !==
											msgStore.current[index - 1].sender
												.id
									) {
										return (
											<>
												<DateEl
													msg={cont}
													msgTwo={
														msgStore.current[
															index - 1
														]
													}
												/>
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-start",
													}}
												>
													<div>
														<p
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"16px 16px 4px 4px",
																	marginTop: 8,
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																		height: 200,
																		width: 200,
																		backgroundSize:
																			"cover",
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											</>
										);
									} else {
										return (
											<>
												<DateEl
													msg={cont}
													msgTwo={
														msgStore.current[
															index - 1
														]
													}
												/>
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-start",
													}}
												>
													<div>
														<p
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"4px 4px 16px 16px",
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																		height: 200,
																		width: 200,
																		backgroundSize:
																			"cover",
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											</>
										);
									}
								} else {
									if (
										index + 1 < msgStore.current.length &&
										msgStore.current[index + 1].sender
											.id !== Ctx.id &&
										msgStore.current[index - 1].sender
											.id !== Ctx.id
									) {
										return (
											<>
												<DateEl
													msg={cont}
													msgTwo={
														msgStore.current[
															index - 1
														]
													}
												/>
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-end",
													}}
												>
													<div>
														<p
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"8px 4px 4px 8px",
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																		height: 200,
																		width: 200,
																		backgroundSize:
																			"cover",
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											</>
										);
									} else if (
										index + 1 < msgStore.current.length &&
										cont.sender.id ===
											msgStore.current[index + 1].sender
												.id &&
										cont.sender.id ===
											msgStore.current[index - 1].sender
												.id
									) {
										return (
											<>
												<DateEl
													msg={cont}
													msgTwo={
														msgStore.current[
															index - 1
														]
													}
												/>
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-end",
													}}
												>
													<div>
														<p
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"8px 4px 4px 8px",
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																		height: 200,
																		width: 200,
																		backgroundSize:
																			"cover",
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											</>
										);
									} else if (
										index + 1 < msgStore.current.length &&
										cont.sender.id !==
											msgStore.current[index - 1].sender
												.id
									) {
										return (
											<>
												<DateEl
													msg={cont}
													msgTwo={
														msgStore.current[
															index - 1
														]
													}
												/>
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-end",
													}}
												>
													<div>
														<p
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"16px 16px 4px 4px",
																	marginTop: 8,
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																		height: 200,
																		width: 200,
																		backgroundSize:
																			"cover",
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											</>
										);
									} else {
										return (
											<>
												<DateEl
													msg={cont}
													msgTwo={
														msgStore.current[
															index - 1
														]
													}
												/>
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-end",
													}}
												>
													<div>
														<p
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"4px 4px 16px 16px",
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																		height: 200,
																		width: 200,
																		backgroundSize:
																			"cover",
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											</>
										);
									}
								}
							} else {
								if (index === 0) {
									if (cont.sender.id !== Ctx.id) {
										if (
											index + 1 <
												msgStore.current.length &&
											msgStore.current[index + 1].sender
												.id !== cont.sender.id
										) {
											return (
												<>
													<DateEl
														msg={cont}
														msgTwo={
															msgStore.current[
																index + 1
															]
														}
													/>
													<div
														key={index}
														style={{
															width: "100%",
															display: "flex",
															justifyContent:
																"flex-start",
														}}
													>
														<div>
															<p
																style={{
																	...styles.msg,
																	...{
																		borderRadius:
																			"8px 4px 4px 8px",
																	},
																}}
															>
																{cont?.type ==
																"message" ? (
																	cont?.content
																) : (
																	<div
																		style={{
																			backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																			height: 200,
																			width: 200,
																			backgroundSize:
																				"cover",
																		}}
																	>
																		&nbsp;
																	</div>
																)}
															</p>
														</div>
													</div>
												</>
											);
										} else if (
											index + 1 <
												msgStore.current.length &&
											cont.sender.id ===
												msgStore.current[index + 1]
													.sender.id
										) {
											return (
												<>
													<DateEl
														msg={cont}
														msgTwo={
															msgStore.current[
																index + 1
															]
														}
													/>
													<div
														key={index}
														style={{
															width: "100%",
															display: "flex",
															justifyContent:
																"flex-start",
														}}
													>
														<div>
															<p
																style={{
																	...styles.msg,
																	...{
																		borderRadius:
																			"16px 16px 4px 4px",
																	},
																}}
															>
																{cont?.type ==
																"message" ? (
																	cont?.content
																) : (
																	<div
																		style={{
																			backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																			height: 200,
																			width: 200,
																			backgroundSize:
																				"cover",
																		}}
																	>
																		&nbsp;
																	</div>
																)}
															</p>
														</div>
													</div>
												</>
											);
										}
									} else {
										if (
											index + 1 <
												msgStore.current.length &&
											msgStore.current[index + 1].sender
												.id !== cont.sender.id
										) {
											return (
												<>
													<DateEl
														msg={cont}
														msgTwo={
															msgStore.current[
																index + 1
															]
														}
													/>
													<div
														key={index}
														style={{
															width: "100%",
															display: "flex",
															justifyContent:
																"flex-end",
														}}
													>
														<div>
															<p
																style={{
																	...styles.msg,
																	...{
																		borderRadius:
																			"4px 8px 8px 4px",
																	},
																}}
															>
																{cont?.type ==
																"message" ? (
																	cont?.content
																) : (
																	<div
																		style={{
																			backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																			height: 200,
																			width: 200,
																			backgroundSize:
																				"cover",
																		}}
																	>
																		&nbsp;
																	</div>
																)}
															</p>
														</div>
													</div>
												</>
											);
										} else if (
											index + 1 <
												msgStore.current.length &&
											cont.sender.id ===
												msgStore.current[index + 1]
													.sender.id
										) {
											return (
												<>
													<DateEl
														msg={cont}
														msgTwo={
															msgStore.current[
																index + 1
															]
														}
													/>
													<div
														key={index}
														style={{
															width: "100%",
															display: "flex",
															justifyContent:
																"flex-end",
														}}
													>
														<div>
															<p
																style={{
																	...styles.msg,
																	...{
																		borderRadius:
																			"16px 16px 4px 4px",
																	},
																}}
															>
																{cont?.type ==
																"message" ? (
																	cont?.content
																) : (
																	<div
																		style={{
																			backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																			height: 200,
																			width: 200,
																			backgroundSize:
																				"cover",
																		}}
																	>
																		&nbsp;
																	</div>
																)}
															</p>
														</div>
													</div>
												</>
											);
										}
									}
								} else {
									if (cont.sender.id !== Ctx.id) {
										if (
											index - 1 <
												msgStore.current.length &&
											msgStore.current[index - 1].sender
												.id !== cont.sender.id
										) {
											return (
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-start",
													}}
												>
													<div>
														<p
															className="bottomMsg"
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"4px 8px 8px 4px",
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																		height: 200,
																		width: 200,
																		backgroundSize:
																			"cover",
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											);
										} else if (
											index - 1 <
												msgStore.current.length &&
											cont.sender.id ===
												msgStore.current[index - 1]
													.sender.id
										) {
											return (
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-start",
													}}
												>
													<div>
														<p
															className="bottomMsg"
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"4px 8px 8px 4px",
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																		height: 200,
																		width: 200,
																		backgroundSize:
																			"cover",
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											);
										}
									} else {
										if (
											index - 1 <
												msgStore.current.length &&
											msgStore.current[index - 1].sender
												.id !== cont.sender.id
										) {
											return (
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-end",
													}}
												>
													<div>
														<p
															className="bottomMsg"
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"8px 4px 4px 8px",
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																		height: 200,
																		width: 200,
																		backgroundSize:
																			"cover",
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											);
										} else if (
											index - 1 <
												msgStore.current.length &&
											cont.sender.id ===
												msgStore.current[index - 1]
													.sender.id
										) {
											return (
												<div
													key={index}
													style={{
														width: "100%",
														display: "flex",
														justifyContent:
															"flex-end",
													}}
												>
													<div>
														<p
															className="bottomMsg"
															style={{
																...styles.msg,
																...{
																	borderRadius:
																		"8px 4px 4px 8px",
																},
															}}
														>
															{cont?.type ==
															"message" ? (
																cont?.content
															) : (
																<div
																	style={{
																		backgroundImage: `url(${Ctx.imageServer}/fetch/chats/${cont?.id})`,
																		height: 200,
																		width: 200,
																		backgroundSize:
																			"cover",
																	}}
																>
																	&nbsp;
																</div>
															)}
														</p>
													</div>
												</div>
											);
										}
									}
								}
							}
						})}
				</div>

				<nav
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						position: "fixed",
						top: 40,
						background: "#fff",
						padding: "16px 0",
						width: "100%",
					}}
				>
					<div style={{ display: "flex", columnGap: 8 }}>
						<img
							src="/shoe_collective.jpg"
							height="40px"
							width="40px"
							style={{ borderRadius: 80 }}
						/>
						<div>
							<h3>{recipient.current?.name}</h3>
							<h5>@{recipient.current?.username}</h5>
						</div>
					</div>
				</nav>
			</section>
		</>
	);
}
const styles = {
	input: {
		width: "calc(100vw - 32px)",
		marginBottom: 16,
		maxWidth: 640,
		display: "flex",
		flexDirection: "row-reverse",
		columnGap: 8,
		position: "fixed",
		bottom: "0%",
		background: "#fff",
		// transform: "translateY(calc(-100% - 8px)"
	},
	msg: {
		color: "#454542",
		padding: "8px 16px",
		background: "#f9f9f9",
		display: "inline-block",
		wordWrap: "break-wrord",
		overflowWrap: "break-word",
		width: "fit-content",
		maxWidth: "calc((100vw - 32px) / 12 * 8)",
		borderRadius: "50px",
		marginBottom: 4,
	},
	middleMsg: {
		borderRadius: "4px 8px 8px 4px",
		marginBottom: 4,
	},
	standaloneMsg: {
		borderRadius: "16px",
		marginBottom: 8,
	},
	view: {
		display: "flex",
		flexDirection: "column-reverse",
		height: "calc(100svh - 48px)",
		overflowY: "scroll",
		boxSizing: "border-box",
	},
};

export default MessageToPerson;
