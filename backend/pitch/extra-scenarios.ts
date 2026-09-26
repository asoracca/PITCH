type Seed = [string, string, string, string, string, string[]?];
const group = (band: string, prefix: string, rows: Seed[]) => rows.map(([id, category, title, prompt, goal, positions]) => ({ id: `${prefix}-${id}`, band, category, title, prompt, goal, positions: positions ?? null }));

// Additional prototype prompts. Original PRD scenarios remain intact.
export const EXTRA_SCENARIOS = [
  ...group('14–17', 'teen', [
    ['interview-mistake', 'career', 'Own a small mistake', 'At your weekend job, you gave a customer the wrong order. Tell your supervisor what happened and what you will do next.', 'Take responsibility and offer a practical correction.'],
    ['volunteer', 'career', 'Find your first volunteer role', 'Introduce yourself to a community center and ask whether you could help with its Saturday events.', 'Explain your interest, availability and how you could contribute.'],
    ['career-question', 'career', 'Ask a speaker a useful question', 'A professional is visiting your class. Ask a question that helps you understand what their job is really like.', 'Ask something specific and leave room for a thoughtful answer.'],
    ['borrowed-headphones', 'conflict', 'Your headphones came back broken', 'A friend returns your borrowed headphones with one side no longer working. Start the conversation without accusing them.', 'Explain what you noticed and agree on a fair next step.'],
    ['lab-credit', 'conflict', 'Share the credit fairly', 'Your lab partner tells the teacher they did most of the experiment, but you split the work evenly. Address it calmly.', 'Clarify the facts and ask for fair recognition.'],
    ['trip-budget', 'money', 'An expensive day out', 'Your friends plan a day out that costs more than you can afford. Suggest an alternative without revealing more than you want to.', 'State a budget boundary and offer an inclusive option.'],
    ['club-budget', 'money', 'One club budget, two ideas', 'Your club has $200 left. Debate buying equipment everyone can use versus spending it on one end-of-year outing.', 'Make a case for your assigned option and acknowledge the trade-off.', ['Buy shared equipment.', 'Fund the end-of-year outing.']],
    ['cancelled-event', 'leadership', 'The venue fell through', 'Your club event is tomorrow and the room booking was cancelled. Explain the situation to your team and propose a backup.', 'Stay calm, set priorities and assign clear next steps.'],
    ['quiet-teammate', 'leadership', 'Make room for a quiet teammate', 'One person has not spoken during a club planning meeting. Invite their ideas without putting them under pressure.', 'Create an easy, respectful way to contribute.'],
    ['say-no', 'social', 'Say no without an excuse', 'A friend wants you to join an activity you do not enjoy. Decline kindly without inventing an excuse.', 'Be clear, warm and honest.'],
    ['group-invite', 'social', 'Someone was left out', 'Your group is arranging a birthday outing, and you notice one friend was accidentally left out of the chat. Bring it up.', 'Include the person without blaming the group.'],
    ['apology', 'social', 'A joke did not land', 'A joke you made upset a friend. Apologize without saying they are too sensitive.', 'Own the impact and explain how you will handle it differently.'],
  ]),
  ...group('18–22', 'student', [
    ['unclear-brief', 'career', 'An unclear internship brief', 'Your supervisor asks you to research competitors but gives no deadline or expected format. Ask for what you need to get started.', 'Clarify the outcome, deadline and priorities concisely.'],
    ['network-followup', 'career', 'Follow up after a great conversation', 'You met an alumnus at a networking event yesterday. Send a short follow-up asking for a 15-minute career conversation.', 'Refer to the conversation and make a specific, low-pressure request.'],
    ['intern-feedback', 'career', 'Your mid-internship check-in', 'Halfway through your internship, ask your supervisor what you should keep doing and what you could improve.', 'Seek specific feedback and a useful action for the next week.'],
    ['chat-tone', 'conflict', 'The group chat got tense', 'A teammate reads your short project message as rude. Clear up the misunderstanding without arguing about their reaction.', 'Acknowledge the impact, explain your intent and reset the conversation.'],
    ['idea-credit', 'conflict', 'A teammate presents your idea', 'During a presentation, a teammate describes your proposal as their own. Speak with them afterward.', 'Explain your concern and agree on how contributions will be credited.'],
    ['travel-budget', 'money', 'Different budgets, one trip', 'Your friends want a graduation trip, but everyone has a different budget. Propose a way to plan fairly.', 'Ask about limits and compare practical alternatives without pressure.'],
    ['dinner-bill', 'money', 'The dinner bill is uneven', 'At a group dinner, some friends ordered much more than others. Suggest how to split the bill.', 'Make a clear, fair proposal and acknowledge different preferences.'],
    ['event-format', 'leadership', 'Online event or in-person meetup?', 'Your student society can host its next networking event online or in person. Debate which format to choose.', 'Defend your assigned format while considering access and engagement.', ['Host the event online.', 'Host the event in person.']],
    ['low-turnout', 'leadership', 'Your event barely filled a room', 'Only six people attended an event your team worked hard on. Lead the debrief without blaming anyone.', 'Recognize the effort and choose one improvement based on evidence.'],
    ['team-priorities', 'leadership', 'Three tasks, one afternoon', 'Your project team has one afternoon to fix three issues before a presentation. Explain how you would choose what comes first.', 'Use clear criteria and assign manageable responsibilities.'],
    ['friend-rejection', 'social', 'Support a disappointed friend', 'Your friend was rejected from an internship they really wanted. Start a supportive conversation without offering instant solutions.', 'Listen, acknowledge their disappointment and ask what support they want.'],
    ['favor-boundary', 'social', 'You cannot always proofread', 'A friend keeps asking you to review assignments at the last minute. Set a boundary while showing you care.', 'State what you can realistically offer and suggest more notice.'],
  ]),
  ...group('23+', 'adult', [
    ['career-pivot', 'career', 'Explain a career pivot', 'An interviewer asks why you are moving from customer support into project coordination. Explain the connection.', 'Link transferable skills to the new role with one example.'],
    ['scope-request', 'career', 'The project keeps getting bigger', 'A stakeholder asks for extra work two days before delivery. Discuss the impact and propose options.', 'Make the trade-offs clear without promising an impossible deadline.'],
    ['mentor-request', 'career', 'Ask someone to mentor you', 'Ask an experienced colleague whether they would be open to a short monthly conversation about your professional growth.', 'Explain your goal and respect their time and ability to decline.'],
    ['workload', 'conflict', 'Everything is urgent', 'Two managers each say their task is your top priority today. Ask them to help agree on an order.', 'Present the conflict neutrally and request a clear decision.'],
    ['interruptions', 'conflict', 'Finish your thought', 'A colleague regularly interrupts you in meetings. Address it respectfully after the meeting.', 'Describe the pattern and make a specific request.'],
    ['trip-cost', 'money', 'A shared holiday costs more', 'The accommodation your friends chose is beyond your budget. Suggest a different plan before anyone books.', 'Be direct about your limit and offer a workable alternative.'],
    ['invoice', 'money', 'A client asks for a discount', 'A freelance client asks for a 25% discount on an agreed project price. Respond while protecting the working relationship.', 'Explain the value and discuss scope or timing alternatives.'],
    ['hybrid-team', 'leadership', 'Choose the team’s meeting format', 'Your distributed team must choose between remote planning meetings and a monthly in-person planning day. Debate the options.', 'Argue your assigned position while considering participation and coordination.', ['Keep planning meetings remote.', 'Hold a monthly in-person planning day.']],
    ['failed-launch', 'leadership', 'A launch missed its target', 'Your team launched a feature and adoption was lower than expected. Open a review meeting.', 'Create space for honest learning and propose a focused next experiment.'],
    ['delegate', 'leadership', 'Delegate without micromanaging', 'You need a teammate to lead a client update you normally handle. Explain the task and the support you can offer.', 'Define the outcome, ownership and check-in points.'],
    ['unwanted-advice', 'social', 'The advice is getting tiring', 'A friend keeps giving unsolicited advice about your career. Tell them what kind of support would help more.', 'Set a kind boundary and explain what you need.'],
    ['missed-milestone', 'social', 'You missed an important day', 'You forgot a close friend’s important milestone. Reach out and apologize without making excuses.', 'Acknowledge the hurt and offer a thoughtful way to reconnect.'],
  ]),
];
